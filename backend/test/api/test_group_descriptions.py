"""Role groups and permission groups store an optional description (#452).

Create, update and read carry it; blank means none; an update that leaves it
out keeps it.

Updated values are read through the group lists, because
``GET /role-groups/{id}`` is cached and an update does not clear it (#465).
That route also needs the response cache initialised, which the app does in its
lifespan; the in-process client does not run it.

In ``test/api/`` because these boot the app in-process: see
`ADR 0012 <../../../docs/adr/0012-test-suites-split-by-environment.md>`_.
"""

from test.utils import API_TEST_PASSWORD as PASSWORD
from test.utils import get_csrf_token
from typing import Any, Dict, Iterator
from uuid import uuid4

import pytest
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from httpx import AsyncClient

from app.core.config import settings

KINDS = [("role-groups", "parent_id"), ("permission-groups", "permission_group_id")]
KIND_IDS = [route for route, _ in KINDS]


@pytest.fixture(autouse=True)
def response_cache() -> Iterator[None]:
    FastAPICache.init(InMemoryBackend(), prefix="test-group-descriptions")
    yield
    FastAPICache.reset()


def url(path: str) -> str:
    return f"{settings.API_V1_STR}{path}"


async def sign_in(client: AsyncClient, user_factory: Any) -> Dict[str, str]:
    email = f"groups-{uuid4().hex[:8]}@example.com"
    await user_factory.create(email=email, password=PASSWORD, is_superuser=True)
    _, headers = await get_csrf_token(client)
    login = await client.post(
        url("/auth/login"), json={"email": email, "password": PASSWORD}, headers=headers
    )
    assert login.status_code == 200, login.text
    _, headers = await get_csrf_token(client)
    return {**headers, "Authorization": f"Bearer {login.json()['data']['access_token']}"}


async def create_group(client: AsyncClient, headers: Dict[str, str], route: str, **fields: Any) -> Any:
    body = {"name": f"group-{uuid4().hex[:8]}", **fields}
    response = await client.post(url(f"/{route}"), json=body, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["data"]


async def update_group(
    client: AsyncClient, headers: Dict[str, str], route: str, group_id: str, **fields: Any
) -> Any:
    response = await client.put(url(f"/{route}/{group_id}"), json=fields, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["data"]


async def read_group(client: AsyncClient, headers: Dict[str, str], route: str, group_id: str) -> Any:
    response = await client.get(url(f"/{route}/{group_id}"), headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["data"]


async def listed_group(client: AsyncClient, headers: Dict[str, str], route: str, group_id: str) -> Any:
    page = 1
    while True:
        response = await client.get(url(f"/{route}?page={page}&size=100"), headers=headers)
        assert response.status_code == 200, response.text
        data = response.json()["data"]
        for item in data["items"]:
            if item["id"] == group_id:
                return item
        assert page < data["pages"], f"group {group_id} is not in the {route} list"
        page += 1


@pytest.mark.parametrize("route", KIND_IDS)
async def test_create_saves_a_description_that_reads_back(
    client: AsyncClient, user_factory: Any, route: str
) -> None:
    headers = await sign_in(client, user_factory)

    created = await create_group(client, headers, route, description="Roles for the support team")

    assert created["description"] == "Roles for the support team"
    detail = await read_group(client, headers, route, created["id"])
    assert detail["description"] == "Roles for the support team"
    listed = await listed_group(client, headers, route, created["id"])
    assert listed["description"] == "Roles for the support team"


@pytest.mark.parametrize("route", KIND_IDS)
async def test_description_is_optional(client: AsyncClient, user_factory: Any, route: str) -> None:
    headers = await sign_in(client, user_factory)

    created = await create_group(client, headers, route)

    assert created["description"] is None
    detail = await read_group(client, headers, route, created["id"])
    assert detail["description"] is None


@pytest.mark.parametrize("route", KIND_IDS)
@pytest.mark.parametrize("cleared", [None, "", "  \n "], ids=["null", "empty", "whitespace"])
async def test_update_changes_and_clears_the_description(
    client: AsyncClient, user_factory: Any, route: str, cleared: str | None
) -> None:
    headers = await sign_in(client, user_factory)
    created = await create_group(client, headers, route, description="First")

    updated = await update_group(client, headers, route, created["id"], description="  Second  ")

    assert updated["description"] == "Second"
    assert (await listed_group(client, headers, route, created["id"]))["description"] == "Second"

    emptied = await update_group(client, headers, route, created["id"], description=cleared)

    assert emptied["description"] is None
    assert (await listed_group(client, headers, route, created["id"]))["description"] is None


@pytest.mark.parametrize("route", KIND_IDS)
async def test_update_without_a_description_keeps_it(
    client: AsyncClient, user_factory: Any, route: str
) -> None:
    headers = await sign_in(client, user_factory)
    created = await create_group(client, headers, route, description="Kept")

    updated = await update_group(client, headers, route, created["id"], name=f"renamed-{uuid4().hex[:8]}")

    assert updated["description"] == "Kept"
    assert (await listed_group(client, headers, route, created["id"]))["description"] == "Kept"


@pytest.mark.parametrize("route", KIND_IDS)
async def test_description_is_limited_to_255_characters(
    client: AsyncClient, user_factory: Any, route: str
) -> None:
    headers = await sign_in(client, user_factory)

    created = await create_group(client, headers, route, description="x" * 255)
    assert created["description"] == "x" * 255

    too_long = "x" * 256
    refused_create = await client.post(
        url(f"/{route}"),
        json={"name": f"group-{uuid4().hex[:8]}", "description": too_long},
        headers=headers,
    )
    assert refused_create.status_code == 422, refused_create.text
    refused_update = await client.put(
        url(f"/{route}/{created['id']}"), json={"description": too_long}, headers=headers
    )
    assert refused_update.status_code == 422, refused_update.text


@pytest.mark.parametrize("route,parent_field", KINDS, ids=KIND_IDS)
async def test_detail_reads_the_descriptions_of_related_groups(
    client: AsyncClient, user_factory: Any, route: str, parent_field: str
) -> None:
    headers = await sign_in(client, user_factory)
    parent = await create_group(client, headers, route, description="The parent")
    child = await create_group(
        client, headers, route, description="The child", **{parent_field: parent["id"]}
    )

    parent_detail = await read_group(client, headers, route, parent["id"])

    children = parent_detail["children" if route == "role-groups" else "groups"]
    assert [item["description"] for item in children] == ["The child"]
    if route == "role-groups":
        child_detail = await read_group(client, headers, route, child["id"])
        assert child_detail["parent"]["description"] == "The parent"
