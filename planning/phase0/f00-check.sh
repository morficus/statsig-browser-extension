#!/usr/bin/env bash
# F00 phase 0: manual checks against the Statsig Console API (F00-T3, F00-T5).
#
# Usage: bash planning/phase0/f00-check.sh <step>
# Run it without a step to see the step list. The runbook is README.md in this folder.
#
# Safety:
# - The Console Key never goes into argv, a URL, or the output. curl reads the key header from a
#   process substitution (`-H @<(printf ...)`, a bash builtin, so no process gets the key as an
#   argument). Every byte the script writes goes through redact_stream.
# - Writes go only to experiments whose name starts with intake_ext_phase0_ and whose status is setup.
# - Only the calls that WL-016 records are made (planning/WORKLOG.md).
# - DRY_RUN=1 prints the requests and sends nothing.
# - The env file is read line by line. It is never sourced or evaluated.
#
# Runs on macOS /bin/bash 3.2. Needs curl and jq.

# SC2016: the single-quoted strings are jq programs. Their $names are jq variables, not bash ones.
# shellcheck disable=SC2016

set -euo pipefail
umask 077

# The same values as src/lib/api-config.ts.
readonly API_BASE_URL='https://statsigapi.net/console/v1'
readonly STATSIG_API_VERSION='20240601'

readonly NAME_PREFIX='intake_ext_phase0_'
# Made up on purpose for t5-401. It is not a secret, so the output does not redact it.
readonly FAKE_KEY='console-PHASE0FAKEKEY0123456789abcdefABCDEF'
readonly REDACTED='<redacted>'
readonly RESULT_COLUMN=72
readonly DOTS='..........................................................................................'

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
readonly SCRIPT_DIR

STEPS=(preflight t3-seed t3-write t3-same-id-new-group t3-delete-one t3-move t3-layer t3 t5-401 t5-403 cleanup)
T3_VARS=(STATSIG_CONSOLE_KEY EXPERIMENT STABLE_ID ENVIRONMENT GROUP_A GROUP_B OTHER_ID_A OTHER_ID_B)

# The names the env file may set. Unset them first, so no value comes from the calling shell and
# none is exported to curl or jq.
unset STATSIG_CONSOLE_KEY EXPERIMENT LAYER_EXPERIMENT LAYER_ID STABLE_ID ENVIRONMENT GROUP_A GROUP_B \
  OTHER_ID_A OTHER_ID_B READ_ONLY_KEY
STATSIG_CONSOLE_KEY=''
EXPERIMENT=''
LAYER_EXPERIMENT=''
LAYER_ID=''
STABLE_ID=''
ENVIRONMENT=''
GROUP_A=''
GROUP_B=''
OTHER_ID_A=''
OTHER_ID_B=''
READ_ONLY_KEY=''

DRY_RUN=${DRY_RUN:-}
ENV_FILE=${PHASE0_ENV_FILE:-$SCRIPT_DIR/.env}
ENV_MESSAGES=''
ENV_FATAL=''
TRIMMED=''

CURRENT_STEP=''
FAILED=0
GUARD_MODE=stop
GUARD_FAILED=0
GUARD_STATUS=''
GUARD_BODY=''
HTTP_STATUS=''
HTTP_BODY=''
STATE=''
LAYER_STATUSES=''
TMP_DIR=''

readonly EMPTY_STATE='{"cond":null,"tuples":[],"valid":true}'
readonly INVALID_STATE='{"cond":null,"tuples":[],"valid":false}'

# Derived views of a GET overrides response. Tuples are sorted and unique, so array equality is set
# equality. A null environment, unitType, or idType stays null.
readonly EXP_NORMALIZE='
  if (.data.userIDOverrides | type) == "array" and (.data.overrides | type) == "array" then
    {valid: true, cond: .data.overrides,
     tuples: ([.data.userIDOverrides[] as $o | ($o.ids // [])[] | [$o.groupID, $o.environment, $o.unitType, .]] | unique)}
  else {valid: false, cond: null, tuples: []} end'
readonly LAYER_NORMALIZE='
  if (.data.idOverrides | type) == "array" and (.data.conditionalOverrides | type) == "array" then
    {valid: true, cond: .data.conditionalOverrides,
     tuples: ([.data.idOverrides[] as $o | ($o.ids // [])[] | [$o.groupName, $o.environment, $o.idType, $o.experimentName, .]] | unique)}
  else {valid: false, cond: null, tuples: []} end'

# cleanup: one line per tuple of a listed ID: "<encoded id>|<query>|<tuple JSON>". The query leaves
# out a null unitType, idType, or environment (WL-016). It is empty when a required value is null.
readonly EXP_DELETE_PLAN='
  $s.tuples[] | select(.[3] as $id | any($ids[]; . == $id))
  | [(.[3] | tostring | @uri),
     (if .[0] == null then ""
      else "groupID=" + (.[0] | tostring | @uri)
        + (if .[2] == null then "" else "&unitType=" + (.[2] | tostring | @uri) end)
        + (if .[1] == null then "" else "&environment=" + (.[1] | tostring | @uri) end) end),
     tojson] | join("|")'
readonly LAYER_DELETE_PLAN='
  $s.tuples[] | select(.[4] as $id | any($ids[]; . == $id))
  | [(.[4] | tostring | @uri),
     (if .[0] == null or .[3] == null then ""
      else "groupName=" + (.[0] | tostring | @uri) + "&experimentName=" + (.[3] | tostring | @uri)
        + (if .[2] == null then "" else "&idType=" + (.[2] | tostring | @uri) end)
        + (if .[1] == null then "" else "&environment=" + (.[1] | tostring | @uri) end) end),
     tojson] | join("|")'

# ---------------------------------------------------------------------------------------------------
# Env file

add_env_message() {
  ENV_MESSAGES="${ENV_MESSAGES}$1"$'\n'
}

# Sets TRIMMED to $1 without leading and trailing blanks. No subshell, so a key never leaves bash.
trim_into() {
  TRIMMED=$1
  TRIMMED=${TRIMMED#"${TRIMMED%%[![:space:]]*}"}
  TRIMMED=${TRIMMED%"${TRIMMED##*[![:space:]]}"}
}

# Reads ENV_FILE. Prints nothing: messages go to ENV_MESSAGES and ENV_FATAL, and main prints them
# through the filter. A message never holds a value from the file.
load_env_file() {
  local dir base perm line name value line_number=0
  local name_pattern='^[A-Za-z_][A-Za-z0-9_]*$' mode_pattern='^[0-7]+$'

  if [ ! -f "$ENV_FILE" ] || [ ! -r "$ENV_FILE" ]; then
    ENV_FATAL="env file not found or not readable: $ENV_FILE. Copy env.example to .env in this folder, or set PHASE0_ENV_FILE."
    return 0
  fi

  dir=$(cd "$(dirname "$ENV_FILE")" && pwd)
  base=$(basename "$ENV_FILE")
  if [ "$(git -C "$dir" rev-parse --is-inside-work-tree 2>/dev/null || true)" = true ]; then
    if ! git -C "$dir" check-ignore -q -- "$base" 2>/dev/null; then
      ENV_FATAL="the key file must be git-ignored: $ENV_FILE is in a git work tree, and git does not ignore it."
      return 0
    fi
  fi

  perm=$(stat -f '%Lp' "$ENV_FILE" 2>/dev/null || stat -c '%a' "$ENV_FILE" 2>/dev/null || true)
  if [[ $perm =~ $mode_pattern ]] && (((8#$perm & 8#044) != 0)); then
    add_env_message "WARNING  $ENV_FILE is readable by group or others. Run: chmod 600 $ENV_FILE"
  fi

  while IFS= read -r line || [ -n "$line" ]; do
    line_number=$((line_number + 1))
    trim_into "${line%$'\r'}"
    line=$TRIMMED
    case $line in '' | '#'*) continue ;; esac
    if [[ $line != *=* ]]; then
      add_env_message "WARNING  $ENV_FILE line $line_number is not NAME=value. It is ignored."
      continue
    fi
    trim_into "${line%%=*}"
    name=$TRIMMED
    if ! [[ $name =~ $name_pattern ]]; then
      add_env_message "WARNING  $ENV_FILE line $line_number is not NAME=value. It is ignored."
      continue
    fi
    trim_into "${line#*=}"
    value=$TRIMMED
    # One pair of matching surrounding quotes.
    case $value in
      \"*\")
        value=${value#\"}
        value=${value%\"}
        ;;
      \'*\')
        value=${value#\'}
        value=${value%\'}
        ;;
    esac
    case $name in
      STATSIG_CONSOLE_KEY) STATSIG_CONSOLE_KEY=$value ;;
      EXPERIMENT) EXPERIMENT=$value ;;
      LAYER_EXPERIMENT) LAYER_EXPERIMENT=$value ;;
      LAYER_ID) LAYER_ID=$value ;;
      STABLE_ID) STABLE_ID=$value ;;
      ENVIRONMENT) ENVIRONMENT=$value ;;
      GROUP_A) GROUP_A=$value ;;
      GROUP_B) GROUP_B=$value ;;
      OTHER_ID_A) OTHER_ID_A=$value ;;
      OTHER_ID_B) OTHER_ID_B=$value ;;
      READ_ONLY_KEY) READ_ONLY_KEY=$value ;;
      *) add_env_message "WARNING  $ENV_FILE line $line_number: unknown name $name. It is ignored." ;;
    esac
  done <"$ENV_FILE"

  GROUP_A=${GROUP_A:-Control}
  GROUP_B=${GROUP_B:-Test}
  OTHER_ID_A=${OTHER_ID_A:-phase0-other-id-a}
  OTHER_ID_B=${OTHER_ID_B:-phase0-other-id-b}
}

# ---------------------------------------------------------------------------------------------------
# Output filter

# Copies stdin to stdout and replaces each key value with <redacted>, as a literal string (the
# quoted pattern turns off glob characters). The longer key goes first, so a key that holds the
# other one is not left half visible.
redact_stream() {
  local line first=$STATSIG_CONSOLE_KEY second=$READ_ONLY_KEY
  if [ "${#second}" -gt "${#first}" ]; then
    first=$READ_ONLY_KEY
    second=$STATSIG_CONSOLE_KEY
  fi
  while IFS= read -r line || [ -n "$line" ]; do
    if [ -n "$first" ]; then line=${line//"$first"/$REDACTED}; fi
    if [ -n "$second" ]; then line=${line//"$second"/$REDACTED}; fi
    printf '%s\n' "$line"
  done
}

# Runs "$@" with its stdout and its stderr each sent through redact_stream. pipefail keeps the
# exit code of "$@".
run_filtered() {
  { { "$@" 2>&3 3>&- | redact_stream 3>&-; } 3>&1 1>&4 4>&- | redact_stream >&2; } 4>&1
}

# ---------------------------------------------------------------------------------------------------
# Output helpers

is_dry() {
  [ "$DRY_RUN" = 1 ]
}

# KIND  label ........ value, with the values lined up.
print_result() {
  local head="$1  $2 " fill
  fill=$((RESULT_COLUMN - ${#head}))
  if [ "$fill" -lt 3 ]; then fill=3; fi
  printf '%s%s %s\n' "$head" "${DOTS:0:fill}" "$3"
}

# check <label> <test command...>: PASS or FAIL. In a dry run: SKIP, and the test does not run.
check() {
  local label=$1
  shift
  if is_dry; then
    print_result CHECK "$label" 'SKIP (dry run)'
    return 0
  fi
  check_now "$label" "$@"
}

# Like check, but runs in a dry run too. For checks that need no response.
check_now() {
  local label=$1
  shift
  if "$@"; then
    print_result CHECK "$label" PASS
  else
    print_result CHECK "$label" FAIL
    FAILED=$((FAILED + 1))
  fi
}

# observe_test <label> <text if yes> <text if no> <test command...>
observe_test() {
  local label=$1 yes_text=$2 no_text=$3
  shift 3
  if is_dry; then
    print_result OBSERVE "$label" 'SKIP (dry run)'
  elif "$@"; then
    print_result OBSERVE "$label" "$yes_text"
  else
    print_result OBSERVE "$label" "$no_text"
  fi
}

observe_skip_if_dry() {
  if is_dry; then
    print_result OBSERVE "$1" 'SKIP (dry run)'
    return 0
  fi
  return 1
}

dry_note() {
  if is_dry; then printf ' (dry run: empty state)'; fi
}

step_header() {
  printf '== %s ==\n' "$CURRENT_STEP"
  date -u '+%Y-%m-%d %H:%M:%S UTC'
  if is_dry; then printf 'DRY RUN  no request is sent\n'; fi
}

stop() {
  printf 'STOP  %s\n' "$1"
  printf 'RESULT %s: STOP (exit 2)\n' "$CURRENT_STEP"
  exit 2
}

config_error() {
  printf 'ERROR  %s\n' "$1" >&2
  exit 2
}

finish_step() {
  if [ "$FAILED" -gt 0 ]; then
    printf 'RESULT %s: FAIL (%s failed)\n' "$CURRENT_STEP" "$FAILED"
    exit 1
  fi
  if is_dry; then
    printf 'RESULT %s: SKIP (dry run)\n' "$CURRENT_STEP"
  else
    printf 'RESULT %s: PASS\n' "$CURRENT_STEP"
  fi
  exit 0
}

require_vars() {
  local name missing=''
  for name in "$@"; do
    if [ -z "${!name}" ]; then missing="$missing $name"; fi
  done
  if [ -n "$missing" ]; then
    config_error "$CURRENT_STEP needs these variables, and $ENV_FILE does not set them:$missing"
  fi
}

usage() {
  cat >&2 <<'EOF'
Usage: bash planning/phase0/f00-check.sh <step>

Steps:
  preflight             Read only. Show the test experiments and their overrides. Run the guard checks.
  t3-seed               PATCH OTHER_ID_A into GROUP_A and OTHER_ID_B into GROUP_B.
  t3-write              PATCH STABLE_ID into GROUP_B. Check that all other overrides stay.
  t3-same-id-new-group  PATCH STABLE_ID into GROUP_A. Observe whether it stays in GROUP_B.
  t3-delete-one         DELETE STABLE_ID from GROUP_A. Check that OTHER_ID_A stays. Send the DELETE again.
  t3-move               Move STABLE_ID from GROUP_A to GROUP_B: DELETE, then PATCH. It stays in GROUP_B.
  t3-layer              PATCH and DELETE layer overrides, with LAYER_ID as the path id.
  t3                    Run t3-seed to t3-layer in order. Stop at the first step that does not exit 0.
  t5-401                Send a made-up key. Show the 401 body and whether it echoes the key.
  t5-403                PATCH with READ_ONLY_KEY. Show the status and the body. SKIP if it is empty.
  cleanup               DELETE STABLE_ID, OTHER_ID_A, and OTHER_ID_B from the test experiment and layer.

Settings: PHASE0_ENV_FILE (default: .env next to this script). DRY_RUN=1 prints the requests and sends nothing.
Exit codes: 0 every check passed, 1 a check failed, 2 config, guard, or precondition error.
EOF
}

# ---------------------------------------------------------------------------------------------------
# HTTP

uri() {
  jq -rn --arg value "$1" '$value | @uri'
}

print_json_or_raw() {
  if printf '%s' "$HTTP_BODY" | jq empty >/dev/null 2>&1; then
    printf '%s' "$HTTP_BODY" | jq .
  else
    printf '%s\n' "$HTTP_BODY"
  fi
}

# Prints HTTP_STATUS and HTTP_BODY. Modes: pretty, raw, experiment (on 200, only the fields the
# script uses).
print_response() {
  printf 'RESPONSE %s\n' "$HTTP_STATUS"
  if [ -z "$HTTP_BODY" ]; then
    printf '  (empty body)\n'
    return 0
  fi
  case $1 in
    raw) printf '%s\n' "$HTTP_BODY" ;;
    experiment)
      if [ "$HTTP_STATUS" = 200 ] && printf '%s' "$HTTP_BODY" | jq -e '.data | type == "object"' >/dev/null 2>&1; then
        printf '  (only the fields this script uses)\n'
        printf '%s' "$HTTP_BODY" |
          jq '{name: .data.name, status: .data.status, idType: .data.idType, groups: [.data.groups[]?.name], layerID: .data.layerID}'
      else
        print_json_or_raw
      fi
      ;;
    *) print_json_or_raw ;;
  esac
}

# http <method> <url> <key: main|read-only|fake> <body or ''> <print mode>
# Sets HTTP_STATUS and HTTP_BODY. The key header reaches curl through a process substitution, so
# the key is never in the arguments of a process. A transport error ends the step as FAIL.
http() {
  local method=$1 url=$2 key_kind=$3 body=$4 print_mode=$5
  local key key_label marker='' out rc=0
  local -a args

  case $method in GET | PATCH | DELETE) ;; *) config_error "refusing method $method" ;; esac
  case $url in "$API_BASE_URL"/*) ;; *) config_error "refusing a URL outside $API_BASE_URL" ;; esac
  case $key_kind in
    main) key=$STATSIG_CONSOLE_KEY key_label=STATSIG_CONSOLE_KEY ;;
    read-only) key=$READ_ONLY_KEY key_label=READ_ONLY_KEY ;;
    fake) key=$FAKE_KEY key_label='the made-up t5-401 key' ;;
    *) config_error "unknown key kind $key_kind" ;;
  esac

  if is_dry; then marker='DRY RUN  '; fi
  printf 'REQUEST  %s%s %s\n' "$marker" "$method" "$url"
  printf '  headers  STATSIG-API-KEY (%s, value not shown), STATSIG-API-VERSION: %s, Accept: application/json' \
    "$key_label" "$STATSIG_API_VERSION"
  if [ -n "$body" ]; then
    printf ', Content-Type: application/json\n  body     %s\n' "$body"
  else
    printf '\n'
  fi

  if is_dry; then
    HTTP_STATUS=''
    HTTP_BODY='{}'
    printf 'RESPONSE DRY RUN  not sent, treated as empty\n'
    return 0
  fi

  args=(-sS --proto '=https' --max-time 30 -w '\n%{http_code}'
    -H "STATSIG-API-VERSION: $STATSIG_API_VERSION" -H 'Accept: application/json')
  if [ "$method" != GET ]; then args+=(-X "$method"); fi
  if [ -n "$body" ]; then args+=(-H 'Content-Type: application/json' --data-binary "$body"); fi

  out=$(curl "${args[@]}" -H @<(printf 'STATSIG-API-KEY: %s\n' "$key") "$url" 2>"$TMP_DIR/curl-stderr") || rc=$?
  if [ "$rc" -ne 0 ]; then
    HTTP_STATUS='000'
    HTTP_BODY=''
    printf 'RESPONSE curl error (exit %s): %s\n' "$rc" "$(tr '\n' ' ' <"$TMP_DIR/curl-stderr")"
    FAILED=$((FAILED + 1))
    finish_step
  fi
  HTTP_STATUS=${out##*$'\n'}
  HTTP_BODY=${out%$'\n'*}
  print_response "$print_mode"

  # Statsig's burst protection (WL-016).
  if [ "$method" != GET ]; then sleep 1; fi
}

# The only calls the script makes (WL-016).

get_experiment() {
  http GET "$API_BASE_URL/experiments/$(uri "$1")" main '' experiment
}

exp_overrides_url() {
  printf '%s/experiments/%s/overrides' "$API_BASE_URL" "$(uri "$EXPERIMENT")"
}

layer_overrides_url() {
  printf '%s/layers/%s/overrides' "$API_BASE_URL" "$(uri "$LAYER_ID")"
}

# patch_exp <group> <id> [key kind]: one entry with exactly one ID.
patch_exp() {
  local body
  body=$(jq -cn --arg group "$1" --arg id "$2" --arg environment "$ENVIRONMENT" \
    '{overrides: [], userIDOverrides: [{groupID: $group, ids: [$id], environment: $environment, unitType: "stableID"}]}')
  http PATCH "$(exp_overrides_url)" "${3:-main}" "$body" pretty
}

# delete_exp_bucket <id> <group>: the single-ID DELETE for the ENVIRONMENT and stableID bucket.
delete_exp_bucket() {
  local query
  query="groupID=$(uri "$2")&unitType=stableID&environment=$(uri "$ENVIRONMENT")"
  http DELETE "$(exp_overrides_url)/userID/$(uri "$1")?$query" main '' pretty
}

# patch_layer <group> <id>: one entry with exactly one ID.
patch_layer() {
  local body
  body=$(jq -cn --arg group "$1" --arg id "$2" --arg environment "$ENVIRONMENT" --arg experiment "$LAYER_EXPERIMENT" \
    '{op: "add", conditionalOverrides: [], idOverrides: [{groupName: $group, ids: [$id], idType: "stableID", environment: $environment, experimentName: $experiment}]}')
  http PATCH "$(layer_overrides_url)" main "$body" pretty
  LAYER_STATUSES="$LAYER_STATUSES $HTTP_STATUS"
}

# delete_layer_bucket <id> <group>
delete_layer_bucket() {
  local query
  query="groupName=$(uri "$2")&experimentName=$(uri "$LAYER_EXPERIMENT")&idType=stableID&environment=$(uri "$ENVIRONMENT")"
  http DELETE "$(layer_overrides_url)/userID/$(uri "$1")?$query" main '' pretty
  LAYER_STATUSES="$LAYER_STATUSES $HTTP_STATUS"
}

# ---------------------------------------------------------------------------------------------------
# State

# set_state <normalize filter> <what a valid response has>: sets STATE from the last response.
set_state() {
  if is_dry; then
    STATE=$EMPTY_STATE
    return 0
  fi
  STATE=$INVALID_STATE
  if [ "$HTTP_STATUS" = 200 ]; then
    STATE=$(printf '%s' "$HTTP_BODY" | jq -S -c "$1" 2>/dev/null) || STATE=$INVALID_STATE
  fi
  if ! state_valid "$STATE"; then
    STATE=$INVALID_STATE
    printf 'WARNING  the GET did not return 200 with %s. The checks that use it fail.\n' "$2"
  fi
}

read_exp_state() {
  http GET "$(exp_overrides_url)" main '' pretty
  set_state "$EXP_NORMALIZE" 'data.overrides[] and data.userIDOverrides[]'
}

read_layer_state() {
  http GET "$(layer_overrides_url)" main '' pretty
  LAYER_STATUSES="$LAYER_STATUSES $HTTP_STATUS"
  set_state "$LAYER_NORMALIZE" 'data.conditionalOverrides[] and data.idOverrides[]'
}

exp_tuple() {
  jq -cn --arg group "$1" --arg environment "$ENVIRONMENT" --arg id "$2" '[$group, $environment, "stableID", $id]'
}

layer_tuple() {
  jq -cn --arg group "$1" --arg environment "$ENVIRONMENT" --arg experiment "$LAYER_EXPERIMENT" --arg id "$2" \
    '[$group, $environment, "stableID", $experiment, $id]'
}

ids_json() {
  jq -cn '$ARGS.positional' --args "$@"
}

# Tests on states. Each one is false when a state is not valid.

jq_test() {
  jq -e -n "$@" >/dev/null 2>&1
}

state_valid() {
  jq_test --argjson s "$1" '$s.valid == true'
}

has_tuple() {
  jq_test --argjson s "$1" --argjson t "$2" '$s.valid and any($s.tuples[]; . == $t)'
}

lacks_tuple() {
  jq_test --argjson s "$1" --argjson t "$2" '$s.valid and all($s.tuples[]; . != $t)'
}

has_both() {
  has_tuple "$1" "$2" && has_tuple "$1" "$3"
}

lacks_id() {
  jq_test --argjson s "$1" --arg id "$2" '$s.valid and all($s.tuples[]; .[-1] != $id)'
}

has_conditional() {
  jq_test --argjson s "$1" '$s.valid and ($s.cond | type) == "array" and ($s.cond | length) > 0'
}

# Every tuple of $1 is in $2.
keeps_all() {
  jq_test --argjson a "$1" --argjson b "$2" '$a.valid and $b.valid and all($a.tuples[]; . as $x | any($b.tuples[]; . == $x))'
}

same_cond() {
  jq_test --argjson a "$1" --argjson b "$2" '$a.valid and $b.valid and $a.cond == $b.cond'
}

same_state() {
  jq_test --argjson a "$1" --argjson b "$2" '$a.valid and $b.valid and $a == $b'
}

# same_others <before> <after> <ids JSON>: the tuples of every ID that is not listed are the same.
same_others() {
  jq_test --argjson a "$1" --argjson b "$2" --argjson ids "$3" \
    'def others($s): [$s.tuples[] | select(.[-1] as $i | any($ids[]; . == $i) | not)];
     $a.valid and $b.valid and others($a) == others($b)'
}

# only_tuple_in_env <state> <tuple>: the tuple is there, and the ID has no other tuple in its environment.
only_tuple_in_env() {
  jq_test --argjson s "$1" --argjson t "$2" \
    '$s.valid and any($s.tuples[]; . == $t) and all($s.tuples[] | select(.[-1] == $t[-1] and .[1] == $t[1]); . == $t)'
}

# same_id_tuples_except <before> <after> <tuple>: the other tuples of the same ID are the same.
same_id_tuples_except() {
  jq_test --argjson a "$1" --argjson b "$2" --argjson t "$3" \
    'def mine($s): [$s.tuples[] | select(.[-1] == $t[-1] and . != $t)];
     $a.valid and $b.valid and mine($a) == mine($b)'
}

status_is() {
  [ "$HTTP_STATUS" = "$1" ]
}

guard_status_is() {
  [ "$GUARD_STATUS" = "$1" ]
}

guard_body_test() {
  printf '%s' "$GUARD_BODY" | jq -e "$1" >/dev/null 2>&1
}

guard_body_has_group() {
  printf '%s' "$GUARD_BODY" | jq -e --arg group "$1" 'any(.data.groups[]?; .name == $group)' >/dev/null 2>&1
}

guard_body_layer_is() {
  printf '%s' "$GUARD_BODY" | jq -e --arg layer "$1" '.data.layerID == $layer' >/dev/null 2>&1
}

starts_with_prefix() {
  case $1 in "$NAME_PREFIX"*) return 0 ;; *) return 1 ;; esac
}

all_layer_calls_200() {
  local status
  for status in $LAYER_STATUSES; do
    if [ "$status" != 200 ]; then return 1; fi
  done
  [ -n "$LAYER_STATUSES" ]
}

check_write() {
  check "$1 returned 200" status_is 200
}

# "Others unchanged" from the brief: the other IDs' tuples and the conditional overrides.
check_others() {
  check "tuples of the other IDs unchanged" same_others "$1" "$2" "$(ids_json "$STABLE_ID")"
  check "conditional overrides unchanged" same_cond "$1" "$2"
}

# ---------------------------------------------------------------------------------------------------
# Guards and preconditions

# Stop mode (writes): GUARD lines, exit 2 on a failure. Report mode (preflight): CHECK lines.
guard_name() {
  local label="$1 starts with $NAME_PREFIX"
  if [ "$GUARD_MODE" = report ]; then
    check_now "$label" starts_with_prefix "$2"
  elif starts_with_prefix "$2"; then
    print_result GUARD "$label" PASS
  else
    print_result GUARD "$label" FAIL
    stop "$1 is \"$2\". This script writes only to test experiments and layers whose name starts with $NAME_PREFIX."
  fi
}

guard_item() {
  local label=$1
  shift
  if [ "$GUARD_MODE" = report ]; then
    check "$label" "$@"
  elif "$@"; then
    print_result GUARD "$label" PASS
  else
    print_result GUARD "$label" FAIL
    GUARD_FAILED=$((GUARD_FAILED + 1))
  fi
}

# guard_test_experiment <variable name> <experiment name> <both|a-only> <expected layerID or ''>
guard_test_experiment() {
  local var=$1 groups=$3 layer_id=$4
  get_experiment "$2"
  GUARD_STATUS=$HTTP_STATUS
  GUARD_BODY=$HTTP_BODY
  if is_dry && [ "$GUARD_MODE" = stop ]; then
    printf 'SKIP  guard checks on the %s response (dry run, they need a response)\n' "$var"
    return 0
  fi
  guard_item "GET /experiments/$var returned 200" guard_status_is 200
  guard_item "$var status is setup" guard_body_test '.data.status == "setup"'
  guard_item "$var idType is stableID" guard_body_test '.data.idType == "stableID"'
  guard_item "GROUP_A ($GROUP_A) is a group of $var" guard_body_has_group "$GROUP_A"
  if [ "$groups" = both ]; then
    guard_item "GROUP_B ($GROUP_B) is a group of $var" guard_body_has_group "$GROUP_B"
  fi
  if [ -n "$layer_id" ]; then
    guard_item "$var layerID is LAYER_ID ($layer_id)" guard_body_layer_is "$layer_id"
  fi
}

# guard_writes <exp|layer|both>: runs before the first write of a step. Name checks first, so a
# wrong name stops the step before any request.
guard_writes() {
  GUARD_MODE=stop
  GUARD_FAILED=0
  case $1 in exp | both) guard_name EXPERIMENT "$EXPERIMENT" ;; esac
  case $1 in layer | both) guard_name LAYER_EXPERIMENT "$LAYER_EXPERIMENT" ;; esac
  # The layer itself must be a test layer too: if PATCH replaces the list, a real layer loses overrides.
  case $1 in layer | both) guard_name LAYER_ID "$LAYER_ID" ;; esac
  case $1 in exp | both) guard_test_experiment EXPERIMENT "$EXPERIMENT" both '' ;; esac
  case $1 in layer | both) guard_test_experiment LAYER_EXPERIMENT "$LAYER_EXPERIMENT" a-only "$LAYER_ID" ;; esac
  if [ "$GUARD_FAILED" -gt 0 ]; then
    stop "$GUARD_FAILED guard check(s) failed. No write was sent."
  fi
}

# precondition <description> <stop message> <test command...>
precondition() {
  local description=$1 message=$2
  shift 2
  if is_dry; then
    printf 'SKIP  precondition: %s (dry run, needs a response)\n' "$description"
  elif "$@"; then
    print_result GUARD "$description" PASS
  else
    print_result GUARD "$description" FAIL
    stop "$message"
  fi
}

require_start_state() {
  precondition "the start GET returned 200 with the expected arrays" \
    "No comparison is possible without a valid start state. No write was sent." state_valid "$1"
}

# ---------------------------------------------------------------------------------------------------
# Steps

step_preflight() {
  local layer
  step_header
  require_vars STATSIG_CONSOLE_KEY EXPERIMENT
  GUARD_MODE=report

  printf -- '-- EXPERIMENT --\n'
  guard_name EXPERIMENT "$EXPERIMENT"
  guard_test_experiment EXPERIMENT "$EXPERIMENT" both ''
  read_exp_state
  check "EXPERIMENT has at least one conditional override" has_conditional "$STATE"

  if [ -n "$LAYER_EXPERIMENT" ]; then
    printf -- '-- LAYER_EXPERIMENT --\n'
    guard_name LAYER_EXPERIMENT "$LAYER_EXPERIMENT"
    guard_test_experiment LAYER_EXPERIMENT "$LAYER_EXPERIMENT" a-only "$LAYER_ID"
    if [ -z "$LAYER_ID" ]; then
      if is_dry; then
        printf 'ACTION  set LAYER_ID=<the layerID of LAYER_EXPERIMENT> in the env file (dry run: no response)\n'
      else
        layer=$(printf '%s' "$GUARD_BODY" | jq -r '.data.layerID // empty' 2>/dev/null || true)
        if [ -n "$layer" ]; then
          printf 'ACTION  set LAYER_ID=%s in the env file\n' "$layer"
        else
          check_now "LAYER_EXPERIMENT has a layerID" false
        fi
      fi
    fi
  fi

  if [ -n "$LAYER_ID" ]; then
    printf -- '-- layer LAYER_ID --\n'
    guard_name LAYER_ID "$LAYER_ID"
    read_layer_state
  fi
  finish_step
}

seed_one() {
  local var=$1 id=$2 group=$3 tuple=$4 before=$5
  if has_tuple "$before" "$tuple"; then
    printf 'SETUP  %s is already in %s (%s). No PATCH.\n' "$var" "$group" "$ENVIRONMENT"
    return 0
  fi
  patch_exp "$group" "$id"
  check_write "PATCH $var into $group ($ENVIRONMENT)"
}

step_t3_seed() {
  local before after seed_a seed_b
  step_header
  require_vars "${T3_VARS[@]}"
  guard_writes exp
  read_exp_state
  before=$STATE
  require_start_state "$before"
  precondition "EXPERIMENT has at least one conditional override" \
    "EXPERIMENT has no conditional override. Add a gate override to it in the Console, then run t3-seed again." \
    has_conditional "$before"

  seed_a=$(exp_tuple "$GROUP_A" "$OTHER_ID_A")
  seed_b=$(exp_tuple "$GROUP_B" "$OTHER_ID_B")
  seed_one OTHER_ID_A "$OTHER_ID_A" "$GROUP_A" "$seed_a" "$before"
  seed_one OTHER_ID_B "$OTHER_ID_B" "$GROUP_B" "$seed_b" "$before"

  read_exp_state
  after=$STATE
  check "OTHER_ID_A in $GROUP_A ($ENVIRONMENT)" has_tuple "$after" "$seed_a"
  check "OTHER_ID_B in $GROUP_B ($ENVIRONMENT)" has_tuple "$after" "$seed_b"
  check "every tuple from before is still there" keeps_all "$before" "$after"
  check "conditional overrides unchanged" same_cond "$before" "$after"
  finish_step
}

step_t3_write() {
  local before after other_a other_b mine_b
  step_header
  require_vars "${T3_VARS[@]}"
  guard_writes exp
  read_exp_state
  before=$STATE
  require_start_state "$before"
  other_a=$(exp_tuple "$GROUP_A" "$OTHER_ID_A")
  other_b=$(exp_tuple "$GROUP_B" "$OTHER_ID_B")
  mine_b=$(exp_tuple "$GROUP_B" "$STABLE_ID")
  precondition "OTHER_ID_A in $GROUP_A and OTHER_ID_B in $GROUP_B ($ENVIRONMENT)" \
    "The seeded IDs are missing. Run t3-seed first." has_both "$before" "$other_a" "$other_b"

  patch_exp "$GROUP_B" "$STABLE_ID"
  check_write "PATCH STABLE_ID into $GROUP_B ($ENVIRONMENT)"

  read_exp_state
  after=$STATE
  check "STABLE_ID in $GROUP_B ($ENVIRONMENT)" has_tuple "$after" "$mine_b"
  check "OTHER_ID_B still in $GROUP_B ($ENVIRONMENT)" has_tuple "$after" "$other_b"
  check "OTHER_ID_A still in $GROUP_A ($ENVIRONMENT)" has_tuple "$after" "$other_a"
  check_others "$before" "$after"
  finish_step
}

step_t3_same_id_new_group() {
  local before after mine_a mine_b
  step_header
  require_vars "${T3_VARS[@]}"
  guard_writes exp
  read_exp_state
  before=$STATE
  require_start_state "$before"
  mine_a=$(exp_tuple "$GROUP_A" "$STABLE_ID")
  mine_b=$(exp_tuple "$GROUP_B" "$STABLE_ID")
  precondition "STABLE_ID in $GROUP_B ($ENVIRONMENT)" "STABLE_ID is not in $GROUP_B. Run t3-write first." \
    has_tuple "$before" "$mine_b"

  patch_exp "$GROUP_A" "$STABLE_ID"
  check_write "PATCH STABLE_ID into $GROUP_A ($ENVIRONMENT)"

  read_exp_state
  after=$STATE
  check "STABLE_ID in $GROUP_A ($ENVIRONMENT)" has_tuple "$after" "$mine_a"
  check_others "$before" "$after"
  observe_test "STABLE_ID still in $GROUP_B after PATCH into $GROUP_A" \
    'yes (in two groups)' 'no (the PATCH moved it)' has_tuple "$after" "$mine_b"
  finish_step
}

step_t3_delete_one() {
  local before first second mine_a other_a
  step_header
  require_vars "${T3_VARS[@]}"
  guard_writes exp
  read_exp_state
  before=$STATE
  require_start_state "$before"
  mine_a=$(exp_tuple "$GROUP_A" "$STABLE_ID")
  other_a=$(exp_tuple "$GROUP_A" "$OTHER_ID_A")
  precondition "STABLE_ID and OTHER_ID_A in $GROUP_A ($ENVIRONMENT)" \
    "STABLE_ID and OTHER_ID_A are not both in $GROUP_A. Run t3-same-id-new-group first." \
    has_both "$before" "$mine_a" "$other_a"

  delete_exp_bucket "$STABLE_ID" "$GROUP_A"
  check_write "DELETE STABLE_ID from $GROUP_A ($ENVIRONMENT)"
  read_exp_state
  first=$STATE
  check "STABLE_ID not in $GROUP_A ($ENVIRONMENT)" lacks_tuple "$first" "$mine_a"
  check "OTHER_ID_A still in $GROUP_A ($ENVIRONMENT)" has_tuple "$first" "$other_a"
  check_others "$before" "$first"
  check "STABLE_ID tuples outside $GROUP_A ($ENVIRONMENT) unchanged" \
    same_id_tuples_except "$before" "$first" "$mine_a"

  printf 'SETUP  send the same DELETE again (WL-016: it is idempotent)\n'
  delete_exp_bucket "$STABLE_ID" "$GROUP_A"
  check_write "second DELETE of STABLE_ID from $GROUP_A ($ENVIRONMENT)"
  read_exp_state
  second=$STATE
  check "second DELETE changed nothing" same_state "$first" "$second"
  finish_step
}

step_t3_move() {
  local start ready end mine_a mine_b
  step_header
  require_vars "${T3_VARS[@]}"
  guard_writes exp
  read_exp_state
  start=$STATE
  require_start_state "$start"
  mine_a=$(exp_tuple "$GROUP_A" "$STABLE_ID")
  mine_b=$(exp_tuple "$GROUP_B" "$STABLE_ID")

  # Setup: put STABLE_ID in GROUP_A only. A dry run decides from an empty state.
  if has_tuple "$start" "$mine_b"; then
    printf 'SETUP  STABLE_ID is in %s (%s). DELETE it there.\n' "$GROUP_B" "$ENVIRONMENT"
    delete_exp_bucket "$STABLE_ID" "$GROUP_B"
    check_write "setup DELETE of STABLE_ID from $GROUP_B ($ENVIRONMENT)"
  else
    printf 'SETUP  STABLE_ID is not in %s (%s)%s. No DELETE.\n' "$GROUP_B" "$ENVIRONMENT" "$(dry_note)"
  fi
  if has_tuple "$start" "$mine_a"; then
    printf 'SETUP  STABLE_ID is already in %s (%s). No PATCH.\n' "$GROUP_A" "$ENVIRONMENT"
  else
    printf 'SETUP  STABLE_ID is not in %s (%s)%s. PATCH it there.\n' "$GROUP_A" "$ENVIRONMENT" "$(dry_note)"
    patch_exp "$GROUP_A" "$STABLE_ID"
    check_write "setup PATCH of STABLE_ID into $GROUP_A ($ENVIRONMENT)"
  fi
  read_exp_state
  ready=$STATE
  check "STABLE_ID in $GROUP_A only ($ENVIRONMENT)" only_tuple_in_env "$ready" "$mine_a"

  # The move as F06-T1 plans it: remove first, then add.
  printf 'MOVE  DELETE STABLE_ID from %s, then PATCH it into %s\n' "$GROUP_A" "$GROUP_B"
  delete_exp_bucket "$STABLE_ID" "$GROUP_A"
  check_write "DELETE STABLE_ID from $GROUP_A ($ENVIRONMENT)"
  patch_exp "$GROUP_B" "$STABLE_ID"
  check_write "PATCH STABLE_ID into $GROUP_B ($ENVIRONMENT)"
  read_exp_state
  end=$STATE
  check "STABLE_ID in $GROUP_B only ($ENVIRONMENT)" only_tuple_in_env "$end" "$mine_b"
  check_others "$start" "$end"
  if [ "$FAILED" -eq 0 ]; then
    printf 'NEXT  reload the Intake Site and run the T4 snippet again (F00-T2)\n'
  fi
  finish_step
}

step_t3_layer() {
  local start mid end mine_a other_a
  step_header
  require_vars "${T3_VARS[@]}" LAYER_EXPERIMENT LAYER_ID
  guard_writes layer
  LAYER_STATUSES=''
  read_layer_state
  start=$STATE
  if ! is_dry && ! state_valid "$start"; then
    print_result OBSERVE "layerID works as the layer path id" "no (GET returned $HTTP_STATUS)"
  fi
  require_start_state "$start"
  mine_a=$(layer_tuple "$GROUP_A" "$STABLE_ID")
  other_a=$(layer_tuple "$GROUP_A" "$OTHER_ID_A")

  patch_layer "$GROUP_A" "$OTHER_ID_A"
  check_write "layer PATCH OTHER_ID_A into $GROUP_A ($ENVIRONMENT)"
  patch_layer "$GROUP_A" "$STABLE_ID"
  check_write "layer PATCH STABLE_ID into $GROUP_A ($ENVIRONMENT)"
  read_layer_state
  mid=$STATE
  check "OTHER_ID_A in $GROUP_A ($ENVIRONMENT) in the layer" has_tuple "$mid" "$other_a"
  check "STABLE_ID in $GROUP_A ($ENVIRONMENT) in the layer" has_tuple "$mid" "$mine_a"
  check "every layer tuple from before is still there" keeps_all "$start" "$mid"
  check "layer conditional overrides unchanged" same_cond "$start" "$mid"

  delete_layer_bucket "$STABLE_ID" "$GROUP_A"
  check_write "layer DELETE STABLE_ID from $GROUP_A ($ENVIRONMENT)"
  read_layer_state
  end=$STATE
  check "STABLE_ID not in $GROUP_A ($ENVIRONMENT) in the layer" lacks_tuple "$end" "$mine_a"
  check "OTHER_ID_A still in $GROUP_A ($ENVIRONMENT) in the layer" has_tuple "$end" "$other_a"
  check "layer tuples of the other IDs unchanged" same_others "$mid" "$end" "$(ids_json "$STABLE_ID")"
  observe_test "layerID works as the layer path id" yes "no (statuses:$LAYER_STATUSES)" all_layer_calls_200
  finish_step
}

step_t3() {
  local sub rc
  step_header
  require_vars "${T3_VARS[@]}" LAYER_EXPERIMENT LAYER_ID
  for sub in t3-seed t3-write t3-same-id-new-group t3-delete-one t3-move t3-layer; do
    printf '\n'
    set +e
    (
      set -e
      run_step "$sub"
    )
    rc=$?
    set -e
    if [ "$rc" -ne 0 ]; then
      printf '\nSTOP  %s exited %s. The steps after it did not run.\n' "$sub" "$rc"
      if [ "$rc" -eq 2 ]; then
        printf 'RESULT t3: STOP (exit 2)\n'
      else
        printf 'RESULT t3: FAIL (1 failed)\n'
      fi
      exit "$rc"
    fi
  done
  printf '\n'
  finish_step
}

longest_key_fragment() {
  local size=${#FAKE_KEY} length start piece
  length=$((size - 1))
  while [ "$length" -ge 4 ]; do
    start=0
    while [ $((start + length)) -le "$size" ]; do
      piece=${FAKE_KEY:start:length}
      if [[ $HTTP_BODY == *"$piece"* ]]; then
        printf '%s' "$piece"
        return 0
      fi
      start=$((start + 1))
    done
    length=$((length - 1))
  done
  return 0
}

step_t5_401() {
  local url fragment
  step_header
  if [ -n "$EXPERIMENT" ]; then
    url="$(exp_overrides_url)"
  else
    url="$API_BASE_URL/experiments"
  fi
  http GET "$url" fake '' raw
  if observe_skip_if_dry 'HTTP status with the made-up key'; then
    observe_skip_if_dry 'body echoes the full key'
    observe_skip_if_dry 'body echoes part of the key (4+ characters)'
    finish_step
  fi
  print_result OBSERVE 'HTTP status with the made-up key' "$HTTP_STATUS"
  if [[ $HTTP_BODY == *"$FAKE_KEY"* ]]; then
    print_result OBSERVE 'body echoes the full key' yes
    print_result OBSERVE 'body echoes part of the key (4+ characters)' 'yes: the full key'
  else
    print_result OBSERVE 'body echoes the full key' no
    fragment=$(longest_key_fragment)
    if [ -n "$fragment" ]; then
      print_result OBSERVE 'body echoes part of the key (4+ characters)' "yes: \"$fragment\""
    else
      print_result OBSERVE 'body echoes part of the key (4+ characters)' no
    fi
  fi
  finish_step
}

step_t5_403() {
  step_header
  if [ -z "$READ_ONLY_KEY" ]; then
    printf 'SKIP  READ_ONLY_KEY is empty. Set it in the env file to run t5-403.\n'
    printf 'RESULT %s: SKIP\n' "$CURRENT_STEP"
    exit 0
  fi
  require_vars STATSIG_CONSOLE_KEY EXPERIMENT STABLE_ID ENVIRONMENT GROUP_A GROUP_B
  guard_writes exp
  patch_exp "$GROUP_A" "$STABLE_ID" read-only
  if observe_skip_if_dry 'HTTP status with READ_ONLY_KEY'; then finish_step; fi
  print_result OBSERVE 'HTTP status with READ_ONLY_KEY' "$HTTP_STATUS"
  case $HTTP_STATUS in
    2??) printf 'WARNING  the read-only key was allowed to write. Run cleanup: it removes STABLE_ID from %s.\n' "$GROUP_A" ;;
  esac
  finish_step
}

# delete_listed <exp|layer> <state> <ids JSON>: a single-ID DELETE for each tuple of a listed ID,
# with that tuple's own values.
delete_listed() {
  local kind=$1 state=$2 ids=$3 plan list line enc_id query tuple
  local -a lines=()
  if [ "$kind" = exp ]; then plan=$EXP_DELETE_PLAN; else plan=$LAYER_DELETE_PLAN; fi
  list=$(jq -r -n --argjson s "$state" --argjson ids "$ids" "$plan")
  while IFS= read -r line; do
    if [ -n "$line" ]; then lines+=("$line"); fi
  done <<<"$list"
  if [ "${#lines[@]}" -eq 0 ]; then
    printf 'SETUP  no tuple of STABLE_ID, OTHER_ID_A, or OTHER_ID_B to delete%s\n' "$(dry_note)"
    return 0
  fi
  for line in "${lines[@]}"; do
    IFS='|' read -r enc_id query tuple <<<"$line"
    if [ -z "$query" ]; then
      printf 'WARNING  cannot delete %s: a required value is null. Remove it in the Console.\n' "$tuple"
      continue
    fi
    printf 'SETUP  delete %s\n' "$tuple"
    if [ "$kind" = exp ]; then
      http DELETE "$(exp_overrides_url)/userID/$enc_id?$query" main '' pretty
    else
      http DELETE "$(layer_overrides_url)/userID/$enc_id?$query" main '' pretty
    fi
    check_write "DELETE $tuple"
  done
}

# cleanup_part <exp|layer> <label>
cleanup_part() {
  local kind=$1 where=$2 ids start end
  ids=$(ids_json "$STABLE_ID" "$OTHER_ID_A" "$OTHER_ID_B")
  printf -- '-- %s --\n' "$where"
  if [ "$kind" = exp ]; then read_exp_state; else read_layer_state; fi
  start=$STATE
  require_start_state "$start"
  delete_listed "$kind" "$start" "$ids"
  if [ "$kind" = exp ]; then read_exp_state; else read_layer_state; fi
  end=$STATE
  check "STABLE_ID gone from $where" lacks_id "$end" "$STABLE_ID"
  check "OTHER_ID_A gone from $where" lacks_id "$end" "$OTHER_ID_A"
  check "OTHER_ID_B gone from $where" lacks_id "$end" "$OTHER_ID_B"
  check "tuples of the other IDs unchanged in $where" same_others "$start" "$end" "$ids"
  check "conditional overrides unchanged in $where" same_cond "$start" "$end"
}

step_cleanup() {
  step_header
  require_vars "${T3_VARS[@]}"
  if [ -n "$LAYER_EXPERIMENT" ] && [ -n "$LAYER_ID" ]; then
    guard_writes both
    cleanup_part exp EXPERIMENT
    cleanup_part layer 'the layer'
  else
    guard_writes exp
    cleanup_part exp EXPERIMENT
    printf 'SKIP  layer cleanup: LAYER_EXPERIMENT and LAYER_ID are not both set\n'
  fi
  printf 'NEXT  remove the gate override and delete the test experiments and layer in the Console\n'
  finish_step
}

# ---------------------------------------------------------------------------------------------------
# Entry point

is_step() {
  local step
  for step in "${STEPS[@]}"; do
    if [ "$1" = "$step" ]; then return 0; fi
  done
  return 1
}

run_step() {
  CURRENT_STEP=$1
  FAILED=0
  case $1 in
    preflight) step_preflight ;;
    t3-seed) step_t3_seed ;;
    t3-write) step_t3_write ;;
    t3-same-id-new-group) step_t3_same_id_new_group ;;
    t3-delete-one) step_t3_delete_one ;;
    t3-move) step_t3_move ;;
    t3-layer) step_t3_layer ;;
    t3) step_t3 ;;
    t5-401) step_t5_401 ;;
    t5-403) step_t5_403 ;;
    cleanup) step_cleanup ;;
  esac
}

main() {
  local tmp_root=${TMPDIR:-/tmp}
  if [ $# -ne 1 ] || ! is_step "$1"; then
    usage
    exit 2
  fi
  if [ -n "$ENV_MESSAGES" ]; then printf '%s' "$ENV_MESSAGES" >&2; fi
  if [ -n "$ENV_FATAL" ]; then config_error "$ENV_FATAL"; fi
  if ! command -v jq >/dev/null 2>&1; then config_error 'jq is required. Install it, then run the step again.'; fi
  if ! is_dry && ! command -v curl >/dev/null 2>&1; then config_error 'curl is required.'; fi
  TMP_DIR=$(mktemp -d "${tmp_root%/}/f00-check.XXXXXX")
  trap 'rm -rf "$TMP_DIR"' EXIT
  run_step "$1"
}

# The guard lets a scratch test source this file and call redact_stream alone.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  if [ $# -eq 1 ] && is_step "$1"; then load_env_file; fi
  run_filtered main "$@"
fi
