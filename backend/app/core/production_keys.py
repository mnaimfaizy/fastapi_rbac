"""Production checks for the keys that sign or encrypt something.

Kept apart from config.py so the digest list does not move the lines the
explainer pages cite there. Nothing here imports the settings.
"""

import hashlib
from typing import Dict, List, Mapping, Optional

# The settings that sign or encrypt something. Production requires each one to
# be set, at least PRODUCTION_KEY_MIN_LENGTH characters, and different from the
# other four (check_production_keys).
PRODUCTION_KEY_FIELDS = (
    "SECRET_KEY",
    "JWT_REFRESH_SECRET_KEY",
    "JWT_RESET_SECRET_KEY",
    "JWT_VERIFICATION_SECRET_KEY",
    "ENCRYPT_KEY",
)
PRODUCTION_KEY_MIN_LENGTH = 32
GENERATE_KEY_COMMAND = 'python3 -c "import secrets; print(secrets.token_urlsafe(48))"'

# Words that mark a key as a placeholder, matched case-insensitively. None can
# appear by chance in a hex key, and a 64-character token_urlsafe key contains
# one with a probability of about one in a million.
PLACEHOLDER_KEY_WORDS = ("change", "your-", "your_", "replace", "example", "placeholder", "generate")

# SHA-256 hex digests of every key value published in this repository's example
# and template files, past and present. Only the digests are kept, so this list
# does not republish the values. test_production_key_checks.py fails when an
# example file gains a value missing from here.
PUBLISHED_EXAMPLE_DIGESTS = frozenset(
    {
        "110e839139dc885840ce96d8a0a12e3186a10531ae062a5df4ee7957c4746dac",
        "11ac6ec52522af4daa71e9b17b7186c194cf83c6921cc345635011667b098582",
        "26df1b1cd92f9440f7f154aae372c70ce235e4e28ee6a4b9aec5ba100944f447",
        "33db8bf3546da760745d8cee0f8e0e0ffb0408bb80dd1dde63aed4b6003177d9",
        "388a5218d2e1566d9ebe2676f0de519a217ed18013797878e72524ca4f012114",
        "3dfe985f6ce482218b479bd851b66f6c9cfce6230ad4859894d44faa23c69e4b",
        "3ef209a1427cba241e13290546537afe8e331416069820556d978ffef6b136be",
        "497cf00697204eb8a832804191691fda5610a2d2a5545eac61942b61c95b7a01",
        "5150860cce75c74ba29b7f00d8a0eb24f413c57f682932f34857d30b2ab8b937",
        "59dd7401ea7955d952dde70bf3d258affff6680027f7ffd92b013a6f6db908bb",
        "5d91b5bf646263a408534a5ad12b9329b83dc8a8c75b55609271f4920885673e",
        "6241a8f0fe60b22fafdeb8c79b1ab5a77cec7db64bc9d06ba9a9be2a58e52b60",
        "62b350d6a16cb72b307c7ca0100c64563a220c56c423fe1ef883a2a71267acce",
        "673e6bbe632d1733216d4356838bcd4e129d3a2d2e235b1c35d90a2f5f1339f0",
        "6eecc8ec328e92ea550c366d94017e018e9ce183f354034f47b368d2551fa1d2",
        "7d8a77c9bacf68cd96917764fa7a461353f1d9aefdfad619967ff25f3df46858",
        "9c6c108609e05beef474036036db35add4df8932cac337a2611455c7ac4ebfb3",
        "9eaf0f75835e33b28d94a6478ea2784fb09db61b93bb42c193536268331f647b",
        "9efae6fea5235b2e72be150346b13779313e6cfe164fb6a8e0779eb98a801fe1",
        "ad3e5ac0c70d9fcf3332e80b6e710b06241276c7216824231dd66cbf2401584f",
        "b0a5616b6d62c49aa700b03db8f14629ed43af9b4f0f8e31adb2ab3ec5079eb1",
        "b3e5ba2540a4cbf99f270065ba4c1358a5a05e7fc2cd92a84629fea54c4a6473",
        "c585c543e4695bc87f3350781d30fb976f9af60304e77b6c7cd0b52fe1a179a7",
        "c626a711db91ae467377671323d65822e456fbf2086342daf76bf7963bec4c31",
        "d086fedd79fed525ad20dd3655ee3291169a9001e498f2342ba7da4491a2d0b1",
        "d886296779431f9fcad53cccbc3d8aecb487a2f6136de29381a54d9303881331",
        "dfbbf7358b1c9c3aa6b9947c237afeed90fcea939db3316e6602686c29ae27f6",
        "dfcc0563373c751af952cc92cec27635a79fda9a85d3f4796e09c0004aebbc26",
        "e2cc43860cd0efe38cd46f4c7e3dadb70702eea4d364ab7fb8aaf5d6c99591df",
        "e3a3fa2da552bb20ddacaa64d285f78ba788fd386ac22565a5f4973bb89d8019",
        "ecee42ed248c59232996a6610866cd4dddc11dad4235c1b7a2ff5c50632c8a4b",
        "f064b7ff90ff5b58ba2fa823737f8e107476212cd7504585c77e004ce52e24d6",
        "f3fd4abe686d35d433b06074ee32641644745d019c155f52c5cfb6d19395ce8c",
        "fb6fbd4987da3f528ed48ac2270d53c2b9e12c11d453a55bdaadfb28372ea601",
    }
)


def check_production_keys(values: Mapping[str, Optional[str]]) -> None:
    """Raise ValueError naming every production key that is unsafe.

    ``values`` maps each name in PRODUCTION_KEY_FIELDS to its configured value,
    or None when no source set it. Messages name keys, never their values.
    """
    problems: List[str] = []
    usable: Dict[str, str] = {}
    for name in PRODUCTION_KEY_FIELDS:
        value = values.get(name)
        if not value:
            problems.append(f"{name} is not set")
            continue
        usable[name] = value
        lowered = value.lower()
        if len(value) < PRODUCTION_KEY_MIN_LENGTH:
            problems.append(f"{name} is shorter than {PRODUCTION_KEY_MIN_LENGTH} characters")
        digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
        if digest in PUBLISHED_EXAMPLE_DIGESTS:
            problems.append(f"{name} is a published example value")
        words = [word for word in PLACEHOLDER_KEY_WORDS if word in lowered]
        if words:
            problems.append(f"{name} looks like a placeholder (contains {words[0]!r})")

    by_value: Dict[str, List[str]] = {}
    for name, value in usable.items():
        by_value.setdefault(value, []).append(name)
    for names in by_value.values():
        if len(names) > 1:
            listed = ", ".join(names[:-1]) + " and " + names[-1]
            problems.append(f"{listed} have the same value")

    if problems:
        raise ValueError(
            "Production refuses these key settings: "
            + "; ".join(problems)
            + ". Each of "
            + ", ".join(PRODUCTION_KEY_FIELDS)
            + " needs its own random value. Generate one per key with: "
            + GENERATE_KEY_COMMAND
        )
