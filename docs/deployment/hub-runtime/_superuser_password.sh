# Generate a FIRST_SUPERUSER_PASSWORD that the backend's password policy accepts
# (sourced, not executed). Seeding refuses a superuser password that fails the
# policy (#272), and hex from gen_secret never has an uppercase letter or a
# special character.
#
# The rules mirror PasswordValidator.validate_complexity in
# backend/app/core/security.py with the default PASSWORD_* settings: 12 to 128
# characters; an uppercase letter, a lowercase letter, a digit and a character
# from PASSWORD_SPECIAL_CHARS; no run of three sequential letters or digits in
# either direction (abc, CBA, 123); no character repeated more than three times
# in a row. backend/test/unit/test_hub_runtime_superuser_password.py runs this
# generator against the real validator, so the two cannot drift apart unseen.
# shellcheck shell=bash

# A subset of PASSWORD_SPECIAL_CHARS that is safe unquoted in an .env file and
# in the sed replacement set_kv_if_empty uses: no #, $, quotes, |, &, / or \.
HUB_PASSWORD_SPECIALS='@%^*_+=.:,-'

hub_random_alnum() {
  local length="$1" out=""
  while ((${#out} < length)); do
    if command -v openssl >/dev/null 2>&1; then
      out+="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9')"
    else
      out+="$(python3 -c "import secrets; print(secrets.token_urlsafe(48))" | tr -dc 'A-Za-z0-9')"
    fi
  done
  printf '%s' "${out:0:length}"
}

hub_char_class() {
  case "$1" in
    [a-z]) printf 'lower' ;;
    [A-Z]) printf 'upper' ;;
    [0-9]) printf 'digit' ;;
    *) printf 'other' ;;
  esac
}

hub_password_meets_policy() {
  local p="$1" i a b c ca cb cc oa ob oc
  ((${#p} >= 12 && ${#p} <= 128)) || return 1
  [[ "$p" =~ [A-Z] && "$p" =~ [a-z] && "$p" =~ [0-9] ]] || return 1
  [[ "$p" == *[$HUB_PASSWORD_SPECIALS]* ]] || return 1
  for ((i = 0; i + 2 < ${#p}; i++)); do
    a="${p:i:1}" b="${p:i+1:1}" c="${p:i+2:1}"
    ca="$(hub_char_class "$a")" cb="$(hub_char_class "$b")" cc="$(hub_char_class "$c")"
    # Four in a row means positions i..i+3 all match.
    if ((i + 3 < ${#p})) && [[ "$a" == "$b" && "$b" == "$c" && "$c" == "${p:i+3:1}" ]]; then
      return 1
    fi
    [[ "$ca" != other && "$ca" == "$cb" && "$cb" == "$cc" ]] || continue
    LC_ALL=C printf -v oa '%d' "'$a"
    LC_ALL=C printf -v ob '%d' "'$b"
    LC_ALL=C printf -v oc '%d' "'$c"
    if ((ob - oa == oc - ob && (ob - oa == 1 || ob - oa == -1))); then
      return 1
    fi
  done
  return 0
}

# 32 characters: 30 random letters and digits, with two random specials placed
# at random positions. Regenerated until every rule holds (a few percent of
# candidates contain a sequential run and are discarded).
gen_superuser_password() {
  local body picks s1 s2 o1 o2 n="${#HUB_PASSWORD_SPECIALS}" candidate p1 p2
  while :; do
    body="$(hub_random_alnum 30)"
    picks="$(hub_random_alnum 4)"
    LC_ALL=C printf -v o1 '%d' "'${picks:0:1}"
    LC_ALL=C printf -v o2 '%d' "'${picks:1:1}"
    s1="${HUB_PASSWORD_SPECIALS:o1 % n:1}"
    s2="${HUB_PASSWORD_SPECIALS:o2 % n:1}"
    LC_ALL=C printf -v p1 '%d' "'${picks:2:1}"
    LC_ALL=C printf -v p2 '%d' "'${picks:3:1}"
    p1=$((p1 % 15))
    p2=$((15 + p2 % 15))
    candidate="${body:0:p1}${s1}${body:p1:p2-p1}${s2}${body:p2}"
    if hub_password_meets_policy "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
}
