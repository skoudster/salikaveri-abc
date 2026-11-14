SALIKAVERI ABC — versio 1.0

Sovellus toimii tavallisena staattisena verkkosivuna. Ei palvelinta eikä käyttäjätunnusta.

IPHONE-KÄYTTÖÖNOTTO (esimerkiksi GitHub Pages):
1. Pura ZIP-tiedosto tietokoneella.
2. Luo GitHubiin uusi repository ja siirrä salikaveri-abc-kansion SISÄLTÖ repositorion juureen.
3. Repository > Settings > Pages > Deploy from a branch > main > /(root) > Save.
4. Odota sivun julkaisemista ja avaa GitHub Pages -osoite iPhonen Safarissa.
5. Safarin Jaa-valikko > Lisää Koti-valikkoon.
6. Avaa sovellus kotivalikon kuvakkeesta. Käy verkkoyhteydellä kerran, jotta offline-tiedostot tallentuvat.

Huomaa: GitHub Pages on julkinen sivu, mutta sovelluksen tallentamat treenitiedot
pysyvät laitteesi selaimen muistissa eivätkä siirry GitHubiin. Älä julkaise
omaa treenihistoriaa sisältävää varmuuskopiota GitHubissa.

KÄYTTÖ:
- Valitse 45/60 min ja lihaskasvu/voima, aloita treeni.
- Muokkaa paino/toistot ja kuittaa tehdyt sarjat.
- Tallenna ja päätä treeni. Seuraava ABC-päivä valitaan automaattisesti.
- Ohjelma > Vie ohjelma / Tuo ohjelma (.json).
- Asetukset > Vie kaikki tiedot / Palauta varmuuskopio.

PAINOPROGRESSIO:
Kun viimeisin kyseisen liikkeen treeni sisältää kaikki määrätyt sarjat
samalla painolla, tavoitealueen ylärajan toistot jokaisessa sarjassa ja
saman harjoittelutilan/tavoitteet, sovellus ehdottaa seuraavalle kerralle
liikekohtaista korotusta. Muuten ehdotus on sama paino. Sovellus ei
mittaa tekniikkaa eikä rasitusta; kuittaa vain laadukkaat sarjat.

RAJOITUKSET:
- Ensimmäisen version painoehdotus perustuu kirjattuihin sarjoihin, ei
  automaattiseen RIR-arvioon. Kuittaa onnistuneiksi vain hallitut sarjat.
- Vaihtoehtoinen liike saa oman tunnisteensa ja historiamerkintänsä.
- 45 ja 60 minuuttia ovat tavoitepituuksia, eivät ajastimen mittaamia aikoja.
- Paikallinen tallennus on selain- ja laitekohtainen. Varmuuskopioi säännöllisesti.
- PWA/offline edellyttää HTTPS-osoitetta. Pelkkä ZIP tai file://-avaus ei riitä.
- Tätä versiota ei ole testattu fyysisellä iPhonella.
