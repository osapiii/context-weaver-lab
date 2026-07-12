from token_utils import hash_token, make_mcp_token, parse_mcp_token


def test_make_parse_and_hash_token():
    token = make_mcp_token(
        organization_id="org-1",
        space_id="space-1",
        connection_id="conn-1",
        secret="secret",
    )

    parsed = parse_mcp_token(token)

    assert parsed.organization_id == "org-1"
    assert parsed.space_id == "space-1"
    assert parsed.connection_id == "conn-1"
    assert parsed.secret == "secret"
    assert hash_token(token) == hash_token(token)
