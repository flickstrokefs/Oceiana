from app.core.arabian_sea import (
    get_sector,
    list_sectors,
    resolve_sector,
)


def test_sector_registry_has_irregular_sectors():
    sectors = list_sectors()

    assert len(sectors) >= 6

    assert all(
        sector["geometry"]["type"] == "Polygon"
        for sector in sectors
    )

    assert all(
        len(
            sector["geometry"]["coordinates"][0]
        ) >= 4
        for sector in sectors
    )


def test_known_sector_lookup():
    sector = get_sector(
        "gulf-of-oman"
    )

    assert sector is not None

    assert (
        sector["type"]
        == "named_marine_feature"
    )


def test_coordinate_resolution_is_inside_authorized_scope():
    assert (
        resolve_sector(
            24.5,
            59.5,
        )
        == "gulf-of-oman"
    )


def test_out_of_scope_coordinate_is_not_assigned():
    assert (
        resolve_sector(
            40.0,
            10.0,
        )
        is None
    )