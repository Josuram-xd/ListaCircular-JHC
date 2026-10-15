import pytest

from app.cartas import Baraja
from app.evaluador import evaluar, nombre_mano

C = lambda s: s.split()


def cat(s):
    return evaluar(C(s))[0]


def test_baraja_52_unicas_y_reparte():
    b = Baraja()
    assert len(set(b.cartas)) == 52
    c = b.repartir()
    assert len(c) == 2 and len(b.cartas) == 50


def test_baraja_desde_lista_reparte_en_orden():
    b = Baraja.desde(["AS", "KD", "2C"])
    assert b.una() == "AS" and b.una() == "KD"


def test_categorias():
    assert cat("AS KD 9C 7H 4D") == 0
    assert cat("AS AD 9C 7H 4D") == 1
    assert cat("AS AD 9C 9H 4D") == 2
    assert cat("AS AD AC 7H 4D") == 3
    assert cat("5S 6D 7C 8H 9D") == 4
    assert cat("AS 9S 7S 4S 2S") == 5
    assert cat("AS AD AC 7H 7D") == 6
    assert cat("AS AD AC AH 7D") == 7
    assert cat("5S 6S 7S 8S 9S") == 8


def test_escalera_rueda_a_5_es_la_mas_baja():
    assert evaluar(C("AS 2D 3C 4H 5D")) == (4, 5)
    assert evaluar(C("AS 2D 3C 4H 5D")) < evaluar(C("2S 3D 4C 5H 6D"))
    assert cat("QS KD AC JH TD") == 4


def test_no_hay_escalera_dando_vuelta():
    assert cat("QS KD AC 2H 3D") == 0


def test_mejor_de_siete_trio_de_ases():
    assert cat("AS KS 9S 4D 2S AD AH") == 3


def test_mejor_de_siete_color_vs_par():
    assert cat("AS KS 9S 4S 2S 7D 7H") == 5


def test_escalera_de_color_sobre_poker_en_siete():
    assert cat("5S 6S 7S 8S 9S 9D 9H") == 8


def test_seis_y_siete_cartas_y_cinco():
    assert evaluar(C("AS AD KC 7H 4D 2C")) [0] == 1
    assert len(C("AS AD KC 7H 4D 2C 3C")) == 7
    with pytest.raises(ValueError):
        evaluar(C("AS AD KC 7H"))


def test_desempate_carta_alta():
    assert evaluar(C("AS KD 9C 7H 4D")) > evaluar(C("AS KD 9C 7H 3D"))


def test_desempate_pareja_con_kicker():
    a = evaluar(C("AS AD KC 7H 4D"))
    b = evaluar(C("AH AC QC 7S 4S"))
    assert a > b


def test_desempate_doble_pareja():
    assert evaluar(C("KS KD 2C 2H 9D")) > evaluar(C("QS QD JC JH AD"))
    assert evaluar(C("KS KD 3C 3H 9D")) > evaluar(C("KH KC 2C 2S AD"))
    assert evaluar(C("KS KD 3C 3H 9D")) > evaluar(C("KH KC 3S 3D 8D"))


def test_desempate_trio_full_poker():
    assert evaluar(C("9S 9D 9C 2H 4D")) > evaluar(C("8S 8D 8C AH KD"))
    assert evaluar(C("3S 3D 3C 2H 2D")) > evaluar(C("2S 2D 2C AH AD"))
    assert evaluar(C("3S 3D 3C 5H 5D")) > evaluar(C("3H 3C 3S 4H 4D"))
    assert evaluar(C("4S 4D 4C 4H 2D")) > evaluar(C("3S 3D 3C 3H AD"))
    assert evaluar(C("4S 4D 4C 4H 3D")) > evaluar(C("4S 4D 4C 4H 2D"))


def test_desempate_color_por_cartas_mas_altas():
    assert evaluar(C("AS KS 9S 4S 2S")) < evaluar(C("AH KH 9H 4H 3H"))
    assert evaluar(C("AS KS 9S 4S 3S")) > evaluar(C("AH KH 9H 4H 2H"))


def test_empate_exacto():
    assert evaluar(C("AS KD 9C 7H 4D")) == evaluar(C("AH KC 9D 7S 4C"))


def test_orden_entre_categorias():
    assert evaluar(C("2S 2D 3C 3H 4D")) > evaluar(C("AS AD KC 7H 4D"))
    assert evaluar(C("2S 3S 4S 5S 7S")) > evaluar(C("AS KD QC JH 9D"))


def test_nombres():
    assert nombre_mano(evaluar(C("AS AD 9C 7H 4D"))) == "Pareja de Ases"
    assert nombre_mano(evaluar(C("AS KD 9C 7H 4D"))) == "Carta Alta: As"
    assert nombre_mano(evaluar(C("AS AD 9C 9H 4D"))) == "Doble Pareja de Ases y Nueves"
    assert nombre_mano(evaluar(C("KS KD KC 7H 4D"))) == "Trío de Reyes"
    assert nombre_mano(evaluar(C("5S 6D 7C 8H 9D"))) == "Escalera al Nueve"
    assert nombre_mano(evaluar(C("AS 9S 7S 4S 2S"))) == "Color al As"
    assert nombre_mano(evaluar(C("AS AD AC 7H 7D"))) == "Full de Ases con Sietes"
    assert nombre_mano(evaluar(C("QS QD QC QH 7D"))) == "Póker de Reinas"
    assert nombre_mano(evaluar(C("5S 6S 7S 8S 9S"))) == "Escalera de Color al Nueve"
    assert nombre_mano(evaluar(C("TS JS QS KS AS"))) == "Escalera Real"
    assert nombre_mano(evaluar(C("AS 2D 3C 4H 5D"))) == "Escalera al Cinco"
