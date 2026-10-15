import pytest

from app.lista_circular import ListaCircular, NodoJugador


def datos(lista, desde=None):
    return [n.dato for n in lista.nodos(desde)]


def test_vacia():
    l = ListaCircular()
    assert l.tamano == 0
    assert l.cabeza is None
    assert datos(l) == []
    assert len(l) == 0


def test_insertar_un_nodo_apunta_a_si_mismo():
    l = ListaCircular()
    n = l.insertar("a")
    assert isinstance(n, NodoJugador)
    assert l.tamano == 1
    assert n.siguiente is n and n.anterior is n
    assert l.cabeza is n


def test_insertar_varios_mantiene_orden_y_enlaces_dobles():
    l = ListaCircular()
    nodos = [l.insertar(x) for x in "abc"]
    assert datos(l) == ["a", "b", "c"]
    assert list(l) == ["a", "b", "c"]
    a, b, c = nodos
    assert a.siguiente is b and b.siguiente is c and c.siguiente is a
    assert a.anterior is c and b.anterior is a and c.anterior is b


def test_iterar_una_vuelta_desde_nodo():
    l = ListaCircular()
    a, b, c = (l.insertar(x) for x in "abc")
    assert datos(l, b) == ["b", "c", "a"]
    assert len(datos(l, c)) == 3


def test_avanzar_y_retroceder_dan_la_vuelta():
    l = ListaCircular()
    a, b, c = (l.insertar(x) for x in "abc")
    assert l.avanzar(c) is a
    assert l.avanzar(a, 2) is c
    assert l.retroceder(a) is c


def test_eliminar_cabeza():
    l = ListaCircular()
    a, b, c = (l.insertar(x) for x in "abc")
    assert l.eliminar(a) == "a"
    assert l.cabeza is b
    assert datos(l) == ["b", "c"]
    assert b.anterior is c and c.siguiente is b
    assert l.tamano == 2


def test_eliminar_medio():
    l = ListaCircular()
    a, b, c = (l.insertar(x) for x in "abc")
    l.eliminar(b)
    assert datos(l) == ["a", "c"]
    assert a.siguiente is c and c.anterior is a
    assert l.cabeza is a


def test_eliminar_ultimo():
    l = ListaCircular()
    a, b, c = (l.insertar(x) for x in "abc")
    l.eliminar(c)
    assert datos(l) == ["a", "b"]
    assert b.siguiente is a and a.anterior is b


def test_eliminar_unico_deja_vacia():
    l = ListaCircular()
    a = l.insertar("a")
    l.eliminar(a)
    assert l.tamano == 0 and l.cabeza is None
    assert datos(l) == []


def test_eliminar_hasta_vaciar_y_reinsertar():
    l = ListaCircular()
    nodos = [l.insertar(x) for x in "ab"]
    for n in nodos:
        l.eliminar(n)
    assert l.tamano == 0
    n = l.insertar("z")
    assert n.siguiente is n and datos(l) == ["z"]


def test_eliminar_nodo_ajeno_o_ya_eliminado_falla():
    l = ListaCircular()
    a = l.insertar("a")
    l.insertar("b")
    l.eliminar(a)
    with pytest.raises(ValueError):
        l.eliminar(a)


def test_buscar():
    l = ListaCircular()
    l.insertar(1)
    n2 = l.insertar(2)
    assert l.buscar(lambda x: x == 2) is n2
    assert l.buscar(lambda x: x == 9) is None


def test_avanzar_en_lista_vacia_falla():
    with pytest.raises(ValueError):
        ListaCircular().avanzar(None)


def test_insertar_inicio_y_despues():
    from app.lista_circular import ListaCircular

    lc = ListaCircular()
    a = lc.insertar_inicio("A")
    assert lc.cabeza is a and a.siguiente is a
    c = lc.insertar("C")
    b = lc.insertar_despues(a, "B")
    z = lc.insertar_inicio("Z")
    assert list(lc) == ["Z", "A", "B", "C"] and lc.cabeza is z
    assert z.anterior is c and c.siguiente is z and b.anterior is a
    assert len(lc) == 4
