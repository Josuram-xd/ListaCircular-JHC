import pytest
from fastapi.testclient import TestClient

from app import main


@pytest.fixture
def client():
    return TestClient(main.app)


def crear(client, names=None):
    r = client.post("/demo/lists", json={"names": names} if names is not None else None)
    assert r.status_code == 201
    return r.json()["list_id"], r.json()["state"]


def op(client, lid, **body):
    return client.post(f"/demo/lists/{lid}/ops", json=body)


def orden(state):
    return [n["name"] for n in state["nodes"]]


def texto(state):
    return " ".join(state["steps"])


def test_crear_vacia_sin_body(client):
    r = client.post("/demo/lists")
    assert r.status_code == 201
    s = r.json()["state"]
    assert s["size"] == 0 and s["pointer"] is None and s["nodes"] == []
    assert s["list_id"] == r.json()["list_id"]


def test_crear_con_nombres(client):
    lid, s = crear(client, ["Ana", "Luis", "Eva"])
    assert orden(s) == ["Ana", "Luis", "Eva"] and s["size"] == 3
    assert s["pointer"] == "Ana"
    ana, luis, eva = s["nodes"]
    assert ana["is_head"] and ana["is_pointer"] and not luis["is_head"]
    assert (ana["next"], ana["prev"]) == ("Luis", "Eva")
    assert (eva["next"], eva["prev"]) == ("Ana", "Luis")
    assert client.get(f"/demo/lists/{lid}").json() == s


@pytest.mark.parametrize("names", [["A", "A"], [""], ["x" * 13], [str(i) for i in range(13)], [1]])
def test_crear_invalido(client, names):
    r = client.post("/demo/lists", json={"names": names})
    assert r.status_code == 422 and isinstance(r.json()["detail"], str)


def test_get_inexistente_404(client):
    assert client.get("/demo/lists/nope").status_code == 404
    assert op(client, "nope", op="advance").status_code == 404


def test_insert_en_vacia(client):
    lid, _ = crear(client)
    s = op(client, lid, op="insert", name="Ana", where="end").json()
    assert s["pointer"] == "Ana"
    assert s["nodes"][0]["next"] == "Ana" and s["nodes"][0]["prev"] == "Ana"
    assert "vacía" in texto(s) and "sí mismo" in texto(s)
    assert s["last_op"] == {"op": "insert", "name": "Ana", "where": "end"}
    assert s["highlight"] == ["Ana"]


def test_insert_end(client):
    lid, _ = crear(client, ["Ana", "Luis"])
    s = op(client, lid, op="insert", name="Eva", where="end").json()
    assert orden(s) == ["Ana", "Luis", "Eva"] and s["nodes"][0]["is_head"]
    assert s["pointer"] == "Ana"
    assert "Eva.anterior = Luis" in texto(s)
    assert set(s["highlight"]) == {"Eva", "Luis", "Ana"}


def test_insert_start_mueve_cabeza(client):
    lid, _ = crear(client, ["Ana", "Luis"])
    s = op(client, lid, op="insert", name="Eva", where="start").json()
    assert orden(s) == ["Eva", "Ana", "Luis"]
    assert s["nodes"][0]["is_head"] and s["pointer"] == "Ana"
    assert "cabeza" in texto(s)


def test_insert_start_un_solo_nodo(client):
    lid, _ = crear(client, ["Ana"])
    s = op(client, lid, op="insert", name="Eva", where="start").json()
    assert orden(s) == ["Eva", "Ana"]
    assert s["nodes"][0]["prev"] == "Ana" and s["nodes"][1]["next"] == "Eva"


def test_insert_after_pointer(client):
    lid, _ = crear(client, ["Ana", "Luis", "Eva"])
    op(client, lid, op="advance")
    s = op(client, lid, op="insert", name="Marta", where="after_pointer").json()
    assert orden(s) == ["Ana", "Luis", "Marta", "Eva"] and s["pointer"] == "Luis"
    assert len(s["steps"]) >= 4


def test_insert_after_pointer_ultimo_y_vacia(client):
    lid, _ = crear(client, ["Ana", "Luis"])
    op(client, lid, op="advance")
    s = op(client, lid, op="insert", name="Eva", where="after_pointer").json()
    assert orden(s) == ["Ana", "Luis", "Eva"] and s["nodes"][0]["is_head"]
    lid2, _ = crear(client)
    s = op(client, lid2, op="insert", name="Ana", where="after_pointer").json()
    assert s["pointer"] == "Ana"


def test_insert_invalidos(client):
    lid, _ = crear(client, ["Ana"])
    for body in [
        dict(op="insert", name="Ana", where="end"),
        dict(op="insert", name="", where="end"),
        dict(op="insert", name="x" * 13, where="end"),
        dict(op="insert", name="B", where="medio"),
        dict(op="insert", where="end"),
        dict(op="insert", name="B"),
        dict(op="bailar"),
        {},
    ]:
        r = op(client, lid, **body)
        assert r.status_code == 422, body
        assert isinstance(r.json()["detail"], str)


def test_maximo_12(client):
    lid, _ = crear(client, [str(i) for i in range(12)])
    r = op(client, lid, op="insert", name="extra", where="end")
    assert r.status_code == 422 and "12" in r.json()["detail"]


def test_remove_medio(client):
    lid, _ = crear(client, ["Ana", "Luis", "Eva"])
    s = op(client, lid, op="remove", name="Luis").json()
    assert orden(s) == ["Ana", "Eva"] and s["size"] == 2
    assert "Ana.siguiente = Eva" in texto(s)
    assert "Eva.anterior = Ana" in texto(s)


def test_remove_cabeza(client):
    lid, _ = crear(client, ["Ana", "Luis", "Eva"])
    op(client, lid, op="advance")  # puntero en Luis
    s = op(client, lid, op="remove", name="Ana").json()
    assert orden(s) == ["Luis", "Eva"] and s["nodes"][0]["is_head"]
    assert "cabeza" in texto(s) and s["pointer"] == "Luis"


def test_remove_puntero_pasa_al_siguiente(client):
    lid, _ = crear(client, ["Ana", "Luis", "Eva"])
    op(client, lid, op="advance")
    s = op(client, lid, op="remove", name="Luis").json()
    assert s["pointer"] == "Eva"
    assert "puntero" in texto(s)


def test_remove_puntero_ultimo_vuelve_a_cabeza(client):
    lid, _ = crear(client, ["Ana", "Luis"])
    op(client, lid, op="advance")
    s = op(client, lid, op="remove", name="Luis").json()
    assert s["pointer"] == "Ana"
    assert s["nodes"][0]["next"] == "Ana" and s["nodes"][0]["prev"] == "Ana"
    assert "sí mismo" in texto(s)


def test_remove_unico_deja_vacia(client):
    lid, _ = crear(client, ["Ana"])
    s = op(client, lid, op="remove", name="Ana").json()
    assert s["size"] == 0 and s["pointer"] is None and s["nodes"] == []
    assert "vacía" in texto(s)


def test_remove_errores(client):
    lid, _ = crear(client, ["Ana"])
    assert op(client, lid, op="remove", name="Zed").status_code == 422
    assert op(client, lid, op="remove").status_code == 422
    lid2, _ = crear(client)
    r = op(client, lid2, op="remove", name="Ana")
    assert r.status_code == 422 and "vacía" in r.json()["detail"]


def test_advance_retreat(client):
    lid, _ = crear(client, ["Ana", "Luis", "Eva"])
    assert op(client, lid, op="advance").json()["pointer"] == "Luis"
    s = op(client, lid, op="retreat").json()
    assert s["pointer"] == "Ana"
    s = op(client, lid, op="retreat").json()
    assert s["pointer"] == "Eva"  # da la vuelta por el círculo
    assert s["steps"] and set(s["highlight"]) == {"Ana", "Eva"}
    assert [n["is_pointer"] for n in s["nodes"]] == [False, False, True]


def test_advance_un_solo_nodo_y_vacia(client):
    lid, _ = crear(client, ["Ana"])
    s = op(client, lid, op="advance").json()
    assert s["pointer"] == "Ana" and "sí mismo" in texto(s)
    lid2, _ = crear(client)
    for o in ("advance", "retreat", "lap"):
        r = op(client, lid2, op=o)
        assert r.status_code == 422 and "vacía" in r.json()["detail"]


def test_lap(client):
    lid, _ = crear(client, ["Ana", "Luis", "Eva"])
    op(client, lid, op="advance")
    s = op(client, lid, op="lap").json()
    assert s["pointer"] == "Luis"
    assert s["highlight"] == ["Luis", "Eva", "Ana"]
    assert len(s["steps"]) >= 4


def test_reset(client):
    lid, _ = crear(client, ["Ana", "Luis"])
    s = op(client, lid, op="reset").json()
    assert s["size"] == 0 and s["pointer"] is None and s["steps"]
    s = op(client, lid, op="reset").json()
    assert "vacía" in texto(s)


def test_usa_lista_circular_real(client):
    from app import demo
    from app.lista_circular import ListaCircular

    lid, _ = crear(client, ["Ana", "Luis"])
    assert isinstance(demo.LISTAS[lid].lista, ListaCircular)
