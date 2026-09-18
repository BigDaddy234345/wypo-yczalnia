/* ================= KONFIGURACJA ================= */
const API = "api/";

/* którego widoku aktualnie dotyczy dzwonek powiadomień: "pracownik" albo "it" */
let trybAktywny = "pracownik";

/* stan aplikacji trzymany w pamięci, odświeżany z bazy danych przy każdej zmianie */
let stanSprzet = [];
let stanWnioski = [];
let stanKonta = [];
let stanPowiadomienia = [];

const MAX_DNI_BEZ_UZASADNIENIA = 7;

/* ================= WARSTWA API (fetch) ================= */
async function apiGet(sciezka){
  const res = await fetch(API + sciezka);
  const d = await res.json().catch(() => ({}));
  if(!res.ok){ throw new Error(d.blad || "Błąd pobierania danych."); }
  return d;
}

async function apiPost(sciezka, dane){
  const res = await fetch(API + sciezka, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(dane)
  });
  const d = await res.json().catch(() => ({}));
  if(!res.ok){ throw new Error(d.blad || "Błąd zapisu."); }
  return d;
}

async function apiPut(sciezka, dane){
  const res = await fetch(API + sciezka, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(dane)
  });
  const d = await res.json().catch(() => ({}));
  if(!res.ok){ throw new Error(d.blad || "Błąd aktualizacji."); }
  return d;
}

async function apiDelete(sciezka){
  const res = await fetch(API + sciezka, { method: "DELETE" });
  const d = await res.json().catch(() => ({}));
  if(!res.ok){ throw new Error(d.blad || "Błąd usuwania."); }
  return d;
}

/* ================= DATY ================= */
function dzisiaj(){
  return new Date().toISOString().slice(0,10);
}
function jutro(){
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0,10);
}
function nastepnyDzien(dataIso){
  const d = new Date(dataIso + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0,10);
}
function formatujDate(iso){
  if(!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pl-PL", {day:"2-digit", month:"2-digit", year:"numeric"});
}
function formatujDataCzas(iso){
  if(!iso) return "—";
  const d = new Date(iso.replace(" ", "T"));
  return d.toLocaleDateString("pl-PL",{day:"2-digit",month:"2-digit"}) + " " + d.toLocaleTimeString("pl-PL",{hour:"2-digit",minute:"2-digit"});
}
function liczbaDniRezerwacji(od, doD){
  const a = new Date(od + "T00:00:00");
  const b = new Date(doD + "T00:00:00");
  return Math.round((b - a) / (1000*60*60*24)) + 1;
}
function zakresyNachodza(aOd, aDo, bOd, bDo){
  return aOd <= bDo && bOd <= aDo;
}

/* ================= TOAST I BEZPIECZEŃSTWO DOM ================= */
function pokazToast(tekst){
  const t = document.getElementById("toast");
  if(!t) return;
  t.textContent = tekst;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

function escapeHtml(str){
  if(str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/`/g, "&#x60;");
}

/* ================= SESJA SERWEROWA ================= */
let sesjaAktualna = null; // {id, email, imie, dzial, rola} albo null

async function wczytajSesje(){
  try {
    const d = await apiGet("sesja.php");
    sesjaAktualna = d.zalogowany ? d.konto : null;
  } catch(e){
    sesjaAktualna = null;
  }
}

function zalogowanyKonto(){
  return (sesjaAktualna && sesjaAktualna.rola === "pracownik") ? sesjaAktualna : null;
}
function zalogowanyAdmin(){
  return (sesjaAktualna && sesjaAktualna.rola === "admin") ? sesjaAktualna : null;
}

/* ================= LOGOWANIE I WYLOGOWANIE PRACOWNIKA ================= */
document.getElementById("btnZaloguj").addEventListener("click", async function(){
  const email = document.getElementById("log_email").value.trim();
  const haslo = document.getElementById("log_haslo").value;
  const blad = document.getElementById("logowanieBlad");
  blad.classList.add("hidden");

  if(!email || !haslo){
    blad.textContent = "Podaj e-mail i hasło.";
    blad.classList.remove("hidden");
    return;
  }

  this.disabled = true;
  try {
    const odp = await apiPost("logowanie.php", {email, haslo});
    if(!odp.sukces || odp.konto.rola !== "pracownik"){
      blad.textContent = odp.sukces ? "To konto nie ma uprawnień pracowniczych." : (odp.blad || "Błąd logowania.");
      blad.classList.remove("hidden");
      if(odp.sukces) await apiPost("wyloguj.php", {});
      return;
    }
    document.getElementById("log_email").value = "";
    document.getElementById("log_haslo").value = "";
    trybAktywny = "pracownik";
    await wczytajSesje();
    pokazToast(`Zalogowano jako ${sesjaAktualna.imie}.`);
    await odswiezWszystko();
  } catch(e){
    blad.textContent = e.message || "Nie udało się połączyć z serwerem.";
    blad.classList.remove("hidden");
  } finally {
    this.disabled = false;
  }
});

document.getElementById("btnWylogujPracownik").addEventListener("click", async () => {
  await apiPost("wyloguj.php", {});
  await wczytajSesje();
  await odswiezWszystko();
  pokazToast("Wylogowano pomyślnie.");
});

/* ================= ZMIANA HASŁA ================= */
document.getElementById("btnPokazZmianeHaslaPracownik").addEventListener("click", () => {
  document.getElementById("zmianaHaslaPracownikPanel").classList.toggle("hidden");
});
document.getElementById("btnZmienHasloPracownik").addEventListener("click", async () => {
  await zmienHaslo("zh_p_obecne", "zh_p_nowe", "zh_p_blad", "zmianaHaslaPracownikPanel");
});

document.getElementById("btnPokazZmianeHaslaAdmin").addEventListener("click", () => {
  document.getElementById("zmianaHaslaAdminPanel").classList.toggle("hidden");
});
document.getElementById("btnZmienHasloAdmin").addEventListener("click", async () => {
  await zmienHaslo("zh_a_obecne", "zh_a_nowe", "zh_a_blad", "zmianaHaslaAdminPanel");
});

async function zmienHaslo(idObecne, idNowe, idBlad, idPanel){
  const hasloObecne = document.getElementById(idObecne).value;
  const hasloNowe = document.getElementById(idNowe).value;
  const blad = document.getElementById(idBlad);
  blad.classList.add("hidden");

  try {
    await apiPost("zmien-haslo.php", {hasloObecne, hasloNowe});
    document.getElementById(idObecne).value = "";
    document.getElementById(idNowe).value = "";
    document.getElementById(idPanel).classList.add("hidden");
    pokazToast("Hasło zostało zmienione.");
  } catch(err){
    blad.textContent = err.message;
    blad.classList.remove("hidden");
  }
}

/* ================= LOGOWANIE ADMINA (IT) ================= */
document.getElementById("btnItLogin").addEventListener("click", zalogujIT);
document.getElementById("it_haslo").addEventListener("keydown", (e) => { if(e.key === "Enter") zalogujIT(); });

async function zalogujIT(){
  const email = document.getElementById("it_email").value.trim();
  const haslo = document.getElementById("it_haslo").value;
  const blad = document.getElementById("itLoginError");
  const btn = document.getElementById("btnItLogin");
  blad.classList.add("hidden");

  if(!email || !haslo){
    blad.textContent = "Podaj e-mail i hasło.";
    blad.classList.remove("hidden");
    return;
  }

  btn.disabled = true;
  try {
    const odp = await apiPost("logowanie.php", {email, haslo});
    if(!odp.sukces || odp.konto.rola !== "admin"){
      blad.textContent = odp.sukces ? "Brak uprawnień administratora." : (odp.blad || "Nieprawidłowe dane logowania.");
      blad.classList.remove("hidden");
      if(odp.sukces) await apiPost("wyloguj.php", {});
      return;
    }
    document.getElementById("it_email").value = "";
    document.getElementById("it_haslo").value = "";
    await wczytajSesje();
    document.getElementById("itGate").classList.add("hidden");
    document.getElementById("itPanel").classList.remove("hidden");
    pokazToast("Zalogowano do panelu IT.");
    await odswiezWszystko();
  } catch(e){
    blad.textContent = e.message || "Błąd połączenia z serwerem.";
    blad.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

document.getElementById("btnWyloguj").addEventListener("click", async () => {
  await apiPost("wyloguj.php", {});
  await wczytajSesje();
  document.getElementById("itPanel").classList.add("hidden");
  document.getElementById("itGate").classList.remove("hidden");
  await odswiezWszystko();
  pokazToast("Wylogowano administratora.");
});

/* ================= PRZEŁĄCZANIE WIDOKÓW (Pracownik / IT) ================= */
document.getElementById("tabPracownik").addEventListener("click", () => {
  document.getElementById("tabPracownik").classList.add("active");
  document.getElementById("tabIT").classList.remove("active");
  document.getElementById("widokPracownik").classList.remove("hidden");
  document.getElementById("widokIT").classList.add("hidden");
  trybAktywny = "pracownik";
  renderDzwonek();
});

document.getElementById("tabIT").addEventListener("click", () => {
  document.getElementById("tabIT").classList.add("active");
  document.getElementById("tabPracownik").classList.remove("active");
  document.getElementById("widokIT").classList.remove("hidden");
  document.getElementById("widokPracownik").classList.add("hidden");
  trybAktywny = "it";

  if(zalogowanyAdmin()){
    document.getElementById("itGate").classList.add("hidden");
    document.getElementById("itPanel").classList.remove("hidden");
  } else {
    document.getElementById("itGate").classList.remove("hidden");
    document.getElementById("itPanel").classList.add("hidden");
  }
  renderDzwonek();
});

/* ================= PODZAKŁADKI PANELU IT ================= */
const PODZAKLADKI_IT = {
  subtabWnioski: "itWnioski",
  subtabSprzet: "itSprzet",
  subtabPracownicy: "itPracownicy",
  subtabPowiadomienia: "itPowiadomienia"
};

Object.keys(PODZAKLADKI_IT).forEach(idPrzycisku => {
  document.getElementById(idPrzycisku).addEventListener("click", () => {
    ustawAktywnyPodtab(idPrzycisku);
  });
});

function ustawAktywnyPodtab(idAktywny){
  Object.entries(PODZAKLADKI_IT).forEach(([idPrzycisku, idPanelu]) => {
    document.getElementById(idPrzycisku).classList.toggle("active", idPrzycisku === idAktywny);
    document.getElementById(idPanelu).classList.toggle("hidden", idPrzycisku !== idAktywny);
  });
}

/* ================= WCZYTYWANIE DANYCH Z BAZY ================= */
async function wczytajDane(){
  if(!sesjaAktualna){
    stanSprzet = []; stanWnioski = []; stanKonta = [];
    return;
  }
  const zadania = [apiGet("sprzet.php"), apiGet("wnioski.php")];
  if(sesjaAktualna.rola === "admin") {
    zadania.push(apiGet("konta.php"));
  }

  const wyniki = await Promise.all(zadania);
  stanSprzet = wyniki[0];
  stanWnioski = wyniki[1];
  stanKonta = sesjaAktualna.rola === "admin" ? (wyniki[2] || []) : [];
}

/* ================= DOSTĘPNOŚĆ SPRZĘTU ================= */
function liczbaSprawnychLaptopow(){
  return stanSprzet.filter(l => l.status !== "W naprawie").length;
}

function obciazenieWDniu(dzien, pomijWniosekId){
  return stanWnioski.filter(w =>
    (w.status === "Oczekujący" || w.status === "Wydany") &&
    w.id != pomijWniosekId &&
    dzien >= w.dataOd && dzien <= w.dataDo
  ).length;
}

function dostepnoscWDniu(dzien, pomijWniosekId){
  const sprawne = liczbaSprawnychLaptopow();
  const zajete = obciazenieWDniu(dzien, pomijWniosekId);
  return sprawne - zajete;
}

function listaDni(od, doD){
  const wynik = [];
  let d = new Date(od + "T00:00:00");
  const koniec = new Date(doD + "T00:00:00");
  while(d <= koniec){
    wynik.push(d.toISOString().slice(0,10));
    d.setDate(d.getDate() + 1);
  }
  return wynik;
}

function laptopyDostepneDlaWniosku(wniosek){
  return stanSprzet.filter(l => {
    if(l.status === "W naprawie") return false;
    const kolizja = stanWnioski.some(w2 =>
      w2.id != wniosek.id &&
      w2.laptopId === l.id &&
      (w2.status === "Wydany" || w2.status === "Oczekujący") &&
      zakresyNachodza(wniosek.dataOd, wniosek.dataDo, w2.dataOd, w2.dataDo)
    );
    return !kolizja;
  });
}

function odmienLaptop(n){
  if(n === 1) return "laptop";
  const ost = n % 10, dzies = n % 100;
  if(dzies >= 12 && dzies <= 14) return "laptopów";
  if(ost >= 2 && ost <= 4) return "laptopy";
  return "laptopów";
}

function renderDostepnoscPodglad(){
  const od = document.getElementById("p_od").value;
  const doD = document.getElementById("p_do").value;
  const cont = document.getElementById("dostepnoscPodglad");
  const listaCont = document.getElementById("listaDostepnosci");

  if(!od || !doD || od > doD){
    cont.innerHTML = "";
    listaCont.innerHTML = '<p class="empty">Wybierz zakres dat powyżej, aby zobaczyć liczbę wolnych laptopów w poszczególnych dniach.</p>';
    return;
  }

  const dni = listaDni(od, doD);
  let minDostepnosc = Infinity;
  let rows = "";
  dni.forEach(dzien => {
    const dost = dostepnoscWDniu(dzien, null);
    minDostepnosc = Math.min(minDostepnosc, dost);
    const klasaBadge = dost <= 0 ? "badge-warn" : (dost <= 1 ? "badge-mid" : "badge-ok");
    const etykieta = dost <= 0 ? "brak wolnych" : (dost + " wolnych");
    rows += `<div class="avail-row"><span class="avail-date">${formatujDate(dzien)}</span><span class="badge ${klasaBadge}">${etykieta}</span></div>`;
  });
  listaCont.innerHTML = rows;

  if(minDostepnosc <= 0){
    cont.innerHTML = `<div class="alert alert-danger">Uwaga: w wybranym zakresie co najmniej jeden dzień nie ma wolnych laptopów. Zgłoszenie zostanie przyjęte, ale może wymagać ustaleń z Działem IT.</div>`;
  } else {
    cont.innerHTML = `<div class="alert alert-ok">W całym wybranym zakresie dostępny jest co najmniej ${minDostepnosc} ${odmienLaptop(minDostepnosc)}.</div>`;
  }
}

document.getElementById("p_od").addEventListener("change", function(){
  aktualizujMinDataDo();
  renderDostepnoscPodglad();
  aktualizujBlokUzasadnienia("p_od", "p_do", "p_uzasadnienieBlok");
});

document.getElementById("p_do").addEventListener("change", function(){
  renderDostepnoscPodglad();
  aktualizujBlokUzasadnienia("p_od", "p_do", "p_uzasadnienieBlok");
});

function aktualizujMinDataDo(){
  const pOd = document.getElementById("p_od");
  const pDo = document.getElementById("p_do");
  const minDlaDo = pOd.value ? nastepnyDzien(pOd.value) : jutro();
  const minOstateczne = minDlaDo > jutro() ? minDlaDo : jutro();
  pDo.min = minOstateczne;
  if(pDo.value && pDo.value < minOstateczne){
    pDo.value = "";
  }
}

function aktualizujBlokUzasadnienia(idOd, idDo, idBlok){
  const od = document.getElementById(idOd).value;
  const doD = document.getElementById(idDo).value;
  const blok = document.getElementById(idBlok);
  if(od && doD && od <= doD && liczbaDniRezerwacji(od, doD) > MAX_DNI_BEZ_UZASADNIENIA){
    blok.classList.remove("hidden");
  } else {
    blok.classList.add("hidden");
  }
}

/* ================= FORMULARZ ZGŁOSZENIA ================= */
document.getElementById("formZgloszenie").addEventListener("submit", async function(e){
  e.preventDefault();
  const konto = zalogowanyKonto();
  if(!konto){
    pokazToast("Musisz być zalogowany, żeby złożyć zgłoszenie.");
    return;
  }
  const od = document.getElementById("p_od").value;
  const doD = document.getElementById("p_do").value;
  if(od > doD){
    pokazToast("Data „od” nie może być późniejsza niż data „do”.");
    return;
  }
  const uzasadnienie = document.getElementById("p_uzasadnienie").value.trim();
  if(liczbaDniRezerwacji(od, doD) > MAX_DNI_BEZ_UZASADNIENIA && !uzasadnienie){
    pokazToast(`Rezerwacja dłuższa niż ${MAX_DNI_BEZ_UZASADNIENIA} dni wymaga uzasadnienia.`);
    return;
  }

  const submitBtn = this.querySelector('button[type="submit"]');
  if(submitBtn) submitBtn.disabled = true;

  try {
    await apiPost("wnioski.php", {
      dataOd: od,
      dataDo: doD,
      cel: document.getElementById("p_cel").value.trim(),
      uzasadnienie
    });
    this.reset();
    document.getElementById("dostepnoscPodglad").innerHTML = "";
    document.getElementById("listaDostepnosci").innerHTML = '<p class="empty">Wybierz zakres dat powyżej, aby zobaczyć liczbę wolnych laptopów w poszczególnych dniach.</p>';
    document.getElementById("p_uzasadnienieBlok").classList.add("hidden");
    pokazToast("Zgłoszenie zostało wysłane do Działu IT.");
    await odswiezWszystko();
  } catch(err){
    pokazToast(err.message);
  } finally {
    if(submitBtn) submitBtn.disabled = false;
  }
});

/* ================= PRACOWNIK: PROŚBA O PRZEDŁUŻENIE ================= */
document.getElementById("pr_nowaDataDo").addEventListener("change", () => {
  const wniosekId = document.getElementById("panelProsbaPrzedluzenia").dataset.wniosekId;
  const w = stanWnioski.find(x => x.id == wniosekId);
  const blok = document.getElementById("pr_uzasadnienieBlok");
  const nowaDataDo = document.getElementById("pr_nowaDataDo").value;
  if(w && nowaDataDo && liczbaDniRezerwacji(w.dataOd, nowaDataDo) > MAX_DNI_BEZ_UZASADNIENIA){
    blok.classList.remove("hidden");
  } else {
    blok.classList.add("hidden");
  }
});

document.getElementById("btnPoprosPrzedluzenie").addEventListener("click", async function(){
  const wniosekId = document.getElementById("panelProsbaPrzedluzenia").dataset.wniosekId;
  const nowaDataDo = document.getElementById("pr_nowaDataDo").value;
  const uzasadnienie = document.getElementById("pr_uzasadnienie").value.trim();

  this.disabled = true;
  try {
    await apiPut("wnioski.php", { id: wniosekId, akcja: "poprosPrzedluzenie", nowaDataDo, uzasadnienie });
    document.getElementById("pr_nowaDataDo").value = "";
    document.getElementById("pr_uzasadnienie").value = "";
    document.getElementById("pr_uzasadnienieBlok").classList.add("hidden");
    pokazToast("Prośba o przedłużenie wysłana do Działu IT.");
    await odswiezWszystko();
  } catch(err){
    pokazToast(err.message);
  } finally {
    this.disabled = false;
  }
});

/* ================= WIDOK PRACOWNIKA: RENDER ================= */
function pillKlasaStatusWniosku(status){
  const mapa = {
    "Oczekujący":"pill-oczekujacy",
    "Wydany":"pill-wydany",
    "Zwrócony":"pill-zwrocony",
    "Anulowany":"pill-anulowany"
  };
  return mapa[status] || "pill-oczekujacy";
}

function renderWidokPracownika(){
  const konto = zalogowanyKonto();
  const auth = document.getElementById("pracownikAuth");
  const panel = document.getElementById("pracownikZalogowany");

  if(!konto){
    auth.classList.remove("hidden");
    panel.classList.add("hidden");
    return;
  }

  auth.classList.add("hidden");
  panel.classList.remove("hidden");
  document.getElementById("zalogowanyImie").textContent = konto.imie;
  document.getElementById("zalogowanyDane").textContent = `${konto.dzial} — ${konto.email}`;

  const aktywna = stanWnioski
    .filter(w => w.email && w.email.toLowerCase() === konto.email.toLowerCase() && (w.status === "Oczekujący" || w.status === "Wydany"))
    .sort((a,b) => a.dataOd < b.dataOd ? -1 : 1)[0];

  const panelAktywna = document.getElementById("aktywnaRezerwacjaPanel");
  const blokNowe = document.getElementById("noweZgloszenieBlok");
  const panelPrzedluzenie = document.getElementById("panelProsbaPrzedluzenia");

  if(aktywna){
    panelAktywna.classList.remove("hidden");
    blokNowe.classList.add("hidden");

    let prosbaHtml = "";
    if(aktywna.prosbaNowaDataDo){
      prosbaHtml = `<div class="alert alert-ok" style="margin-top:10px;">Prośba o przedłużenie do ${formatujDate(aktywna.prosbaNowaDataDo)} oczekuje na decyzję IT.</div>`;
    }
    let odmowaHtml = "";
    if(aktywna.status === "Oczekujący" && aktywna.uzasadnienie){
      odmowaHtml = `<p style="margin:8px 0 0; color:var(--steel); font-size:13px;">Uzasadnienie dłuższego terminu: ${escapeHtml(aktywna.uzasadnienie)}</p>`;
    }
    let oddajHtml = "";
    if(aktywna.status === "Wydany"){
      oddajHtml = `<button class="btn btn-dark btn-small" style="margin-top:10px;" data-action="oddajWlasny" data-id="${escapeHtml(aktywna.id)}">Oddaj laptop</button>`;
    }

    document.getElementById("aktywnaRezerwacjaTresc").innerHTML = `
      <p style="margin:0 0 8px;">Masz już zgłoszoną rezerwację — dopóki się nie zakończy (zwrot albo anulowanie przez IT), nie możesz złożyć kolejnej.</p>
      <div class="avail-row">
        <span class="avail-date">${formatujDate(aktywna.dataOd)} – ${formatujDate(aktywna.dataDo)}</span>
        <span class="pill ${pillKlasaStatusWniosku(aktywna.status)}">${escapeHtml(aktywna.status)}</span>
      </div>
      <p style="margin:8px 0 0; color:var(--steel); font-size:13px;">Cel: ${escapeHtml(aktywna.cel)}${aktywna.laptopId ? " · Laptop: " + escapeHtml(aktywna.laptopId) : ""}</p>
      ${odmowaHtml}
      ${prosbaHtml}
      ${oddajHtml}
    `;

    if(aktywna.status === "Wydany" && !aktywna.prosbaNowaDataDo){
      panelPrzedluzenie.classList.remove("hidden");
      panelPrzedluzenie.dataset.wniosekId = aktywna.id;
      document.getElementById("pr_nowaDataDo").min = nastepnyDzien(aktywna.dataDo);
    } else {
      panelPrzedluzenie.classList.add("hidden");
    }
  } else {
    panelAktywna.classList.add("hidden");
    blokNowe.classList.remove("hidden");
  }
}

// Obsługa przycisku zwrotu w widoku pracownika przez delegację
document.getElementById("aktywnaRezerwacjaTresc").addEventListener("click", async (e) => {
  const btn = e.target.closest('button[data-action="oddajWlasny"]');
  if(!btn) return;
  const id = btn.dataset.id;
  if(!confirm("Potwierdź oddanie laptopa — Dział IT zostanie o tym poinformowany.")) return;
  try {
    await apiPut("wnioski.php", { id, akcja: "oddaj" });
    pokazToast("Laptop oddany, dziękujemy!");
    await odswiezWszystko();
  } catch(err){
    pokazToast(err.message);
  }
});

/* ================= PANEL IT: SPRZĘT (EVENT DELEGATION) ================= */
document.getElementById("btnDodajSprzet").addEventListener("click", async function(){
  const id = document.getElementById("s_id").value.trim();
  const model = document.getElementById("s_model").value.trim();
  const sn = document.getElementById("s_sn").value.trim();
  const status = document.getElementById("s_status").value;
  const notatki = document.getElementById("s_notatki").value.trim();

  if(!id || !model){
    pokazToast("Podaj przynajmniej nr inwentarzowy i model.");
    return;
  }

  this.disabled = true;
  try {
    await apiPost("sprzet.php", {id, model, sn, status, notatki});
    ["s_id","s_model","s_sn","s_notatki"].forEach(fid => document.getElementById(fid).value = "");
    document.getElementById("s_status").value = "Dostępny";
    pokazToast("Laptop dodany do ewidencji.");
    await odswiezWszystko();
  } catch(err){
    pokazToast(err.message);
  } finally {
    this.disabled = false;
  }
});

function renderTabelaSprzet(){
  const tbody = document.querySelector("#tabelaSprzet tbody");
  if(stanSprzet.length === 0){
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Brak sprzętu w ewidencji.</td></tr>`;
    return;
  }
  tbody.innerHTML = stanSprzet.map(l => `
    <tr>
      <td><span class="id-tag">${escapeHtml(l.id)}</span></td>
      <td>${escapeHtml(l.model)}</td>
      <td class="mono">${escapeHtml(l.sn || "—")}</td>
      <td>
        <select class="select-inline" data-action="zmienStatusSprzetu" data-id="${escapeHtml(l.id)}">
          <option value="Dostępny" ${l.status==="Dostępny"?"selected":""}>Dostępny</option>
          <option value="Wypożyczony" ${l.status==="Wypożyczony"?"selected":""}>Wypożyczony</option>
          <option value="W naprawie" ${l.status==="W naprawie"?"selected":""}>W naprawie</option>
        </select>
      </td>
      <td style="max-width:220px;">${escapeHtml(l.notatki || "—")}</td>
      <td class="actions-cell">
        <button class="btn btn-outline btn-small" data-action="edytujNotatki" data-id="${escapeHtml(l.id)}">Notatki</button>
        <button class="btn btn-danger btn-small" data-action="usunSprzet" data-id="${escapeHtml(l.id)}">Usuń</button>
      </td>
    </tr>
  `).join("");
}

// Delegacja zdarzeń dla tabeli sprzętu
document.querySelector("#tabelaSprzet").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if(!btn) return;
  const id = btn.dataset.id;
  const akcja = btn.dataset.action;

  if(akcja === "edytujNotatki"){
    const l = stanSprzet.find(x => x.id === id);
    if(!l) return;
    const nowe = prompt("Notatki o stanie technicznym:", l.notatki || "");
    if(nowe === null) return;
    try {
      await apiPut("sprzet.php", {id, notatki: nowe.trim()});
      await odswiezWszystko();
    } catch(err){
      pokazToast(err.message);
    }
  } else if(akcja === "usunSprzet"){
    if(!confirm(`Usunąć laptop ${id} z ewidencji?`)) return;
    try {
      await apiDelete(`sprzet.php?id=${encodeURIComponent(id)}`);
      pokazToast(`Laptop ${id} usunięty.`);
      await odswiezWszystko();
    } catch(err){
      pokazToast(err.message);
    }
  }
});

document.querySelector("#tabelaSprzet").addEventListener("change", async (e) => {
  const sel = e.target.closest('select[data-action="zmienStatusSprzetu"]');
  if(!sel) return;
  const id = sel.dataset.id;
  const nowyStatus = sel.value;
  try {
    await apiPut("sprzet.php", {id, status: nowyStatus});
    pokazToast(`Status laptopa ${id} zmieniony.`);
    await odswiezWszystko();
  } catch(err){
    pokazToast(err.message);
  }
});

/* ================= PANEL IT: PRACOWNICY ================= */
document.getElementById("btnDodajKonto").addEventListener("click", async function(){
  const imie = document.getElementById("k_imie").value.trim();
  const dzial = document.getElementById("k_dzial").value.trim();
  const email = document.getElementById("k_email").value.trim();
  const haslo = document.getElementById("k_haslo").value;
  const blad = document.getElementById("kontoBlad");
  blad.classList.add("hidden");

  if(!imie || !dzial || !email || !haslo){
    blad.textContent = "Uzupełnij wszystkie pola.";
    blad.classList.remove("hidden");
    return;
  }

  this.disabled = true;
  try {
    await apiPost("konta.php", {imie, dzial, email, haslo});
    ["k_imie","k_dzial","k_email","k_haslo"].forEach(id => document.getElementById(id).value = "");
    pokazToast(`Konto dla ${imie} zostało założone.`);
    await odswiezWszystko();
  } catch(err){
    blad.textContent = err.message;
    blad.classList.remove("hidden");
  } finally {
    this.disabled = false;
  }
});

function renderTabelaKonta(){
  const tbody = document.querySelector("#tabelaKonta tbody");
  if(stanKonta.length === 0){
    tbody.innerHTML = `<tr><td colspan="4" class="empty">Brak założonych kont pracowniczych.</td></tr>`;
    return;
  }
  tbody.innerHTML = stanKonta.map(k => `
    <tr>
      <td>${escapeHtml(k.imie)}</td>
      <td>${escapeHtml(k.dzial)}</td>
      <td class="mono">${escapeHtml(k.email)}</td>
      <td class="actions-cell">
        <button class="btn btn-danger btn-small" data-action="usunKonto" data-id="${k.id}">Usuń</button>
      </td>
    </tr>
  `).join("");
}

document.querySelector("#tabelaKonta").addEventListener("click", async (e) => {
  const btn = e.target.closest('button[data-action="usunKonto"]');
  if(!btn) return;
  const id = btn.dataset.id;
  if(!confirm("Czy na pewno usunąć to konto?")) return;
  try {
    await apiDelete(`konta.php?id=${id}`);
    pokazToast("Konto usunięte.");
    await odswiezWszystko();
  } catch(err){
    pokazToast(err.message);
  }
});

/* ================= PANEL IT: WNIOSKI (EVENT DELEGATION) ================= */
function jestPrzeterminowany(w){
  return w.status === "Wydany" && w.dataDo < dzisiaj();
}

function renderAlertKonflikty(konfliktowe){
  const cont = document.getElementById("alertKonflikty");
  if(!cont) return;
  if(konfliktowe.length === 0){
    cont.innerHTML = "";
    return;
  }
  cont.innerHTML = `<div class="alert alert-danger"><div><strong>Konflikt dostępności.</strong> ${konfliktowe.length} przeterminowanych wniosków dotyczy zwrotu przy braku wolnych laptopów w magazynie. Wiersze podświetlone na czerwono wymagają pilnej interwencji.</div></div>`;
}

function renderTabelaWnioski(){
  const tbody = document.querySelector("#tabelaWnioski tbody");
  const wnioski = stanWnioski.slice().sort((a,b) => a.dataOd < b.dataOd ? -1 : 1);

  if(wnioski.length === 0){
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Brak zgłoszeń.</td></tr>`;
    renderAlertKonflikty([]);
    return;
  }

  const konfliktowe = [];

  tbody.innerHTML = wnioski.map(w => {
    const przeterm = jestPrzeterminowany(w);
    const dostepneTeraz = liczbaSprawnychLaptopow() - obciazenieWDniu(dzisiaj(), w.id);
    const brakBufora = przeterm && dostepneTeraz <= 0;
    if(brakBufora) konfliktowe.push(w);

    const opcjeLaptopow = laptopyDostepneDlaWniosku(w)
      .map(l => `<option value="${escapeHtml(l.id)}" ${w.laptopId===l.id?"selected":""}>${escapeHtml(l.id)} — ${escapeHtml(l.model)}</option>`)
      .join("");

    let akcje = "";
    if(w.status === "Oczekujący"){
      akcje += `<button class="btn btn-primary btn-small" data-action="wydaj" data-id="${w.id}">Wydaj</button>`;
      akcje += `<button class="btn btn-outline btn-small" data-action="odrzuc" data-id="${w.id}">Odrzuć</button>`;
    } else if(w.status === "Wydany"){
      akcje += `<button class="btn btn-dark btn-small" data-action="zwroc" data-id="${w.id}">Zwrot</button>`;
      akcje += `<button class="btn btn-outline btn-small" data-action="przedluz" data-id="${w.id}">Przedłuż</button>`;
    }
    akcje += `<button class="btn btn-outline btn-small" data-action="edytujDaty" data-id="${w.id}">Edytuj daty</button>`;
    akcje += `<button class="btn btn-danger btn-small" data-action="usunWniosek" data-id="${w.id}">Usuń</button>`;

    let selectLaptop = "—";
    if(w.status === "Wydany" || w.status === "Oczekujący"){
      selectLaptop = `<select class="select-inline" data-action="przypiszLaptop" data-id="${w.id}">
          <option value="">— brak —</option>
          ${opcjeLaptopow}
        </select>`;
    } else if(w.laptopId){
      selectLaptop = `<span class="id-tag">${escapeHtml(w.laptopId)}</span>`;
    }

    let celOpis = escapeHtml(w.cel);
    if(w.uzasadnienie){
      celOpis += `<div style="color:var(--steel); font-size:12px; margin-top:4px;">Uzasadnienie: ${escapeHtml(w.uzasadnienie)}</div>`;
    }
    if(w.status === "Anulowany" && w.powodOdmowy){
      celOpis += `<div style="color:var(--red); font-size:12px; margin-top:4px;">Odrzucono: ${escapeHtml(w.powodOdmowy)}</div>`;
    }
    if(w.prosbaNowaDataDo){
      celOpis += `
        <div class="alert alert-ok" style="margin-top:6px; padding:8px 10px; font-size:12px;">
          <div>Prośba o przedłużenie do <strong>${formatujDate(w.prosbaNowaDataDo)}</strong>${w.prosbaUzasadnienie ? " — " + escapeHtml(w.prosbaUzasadnienie) : ""}</div>
          <div class="actions-cell" style="margin-top:6px;">
            <button class="btn btn-primary btn-small" data-action="akceptujPrzedluzenie" data-id="${w.id}">Akceptuj</button>
            <button class="btn btn-outline btn-small" data-action="odrzucPrzedluzenie" data-id="${w.id}">Odrzuć</button>
          </div>
        </div>`;
    }

    return `
      <tr class="${brakBufora ? "row-overdue" : ""}">
        <td>
          <div style="font-weight:600;">${escapeHtml(w.imie || "—")}</div>
          <div class="mono" style="color:var(--steel); font-size:11.5px;">${escapeHtml(w.email || "—")}</div>
        </td>
        <td>${escapeHtml(w.dzial || "—")}</td>
        <td class="mono">${formatujDate(w.dataOd)} – ${formatujDate(w.dataDo)}${przeterm ? '<br><span style="color:var(--red); font-weight:600;">przeterminowany</span>' : ""}</td>
        <td style="max-width:220px;">${celOpis}</td>
        <td><span class="pill ${pillKlasaStatusWniosku(w.status)}">${escapeHtml(w.status)}</span></td>
        <td>${selectLaptop}</td>
        <td class="actions-cell">${akcje}</td>
      </tr>
    `;
  }).join("");

  renderAlertKonflikty(konfliktowe);
}

// Obsługa kliknięć w tabeli wniosków przez delegację zdarzeń
document.querySelector("#tabelaWnioski").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if(!btn) return;
  const id = btn.dataset.id;
  const akcja = btn.dataset.action;

  if(akcja === "wydaj"){
    const w = stanWnioski.find(x => x.id == id);
    if(!w) return;
    if(!w.laptopId){
      pokazToast("Najpierw przypisz laptop do tego wniosku.");
      return;
    }
    try {
      await apiPut("wnioski.php", {id, akcja: "wydaj"});
      pokazToast(`Wydano laptop ${w.laptopId}.`);
      await odswiezWszystko();
    } catch(err){
      pokazToast(err.message);
    }
  } else if(akcja === "odrzuc"){
    const powod = prompt("Powód odrzucenia zgłoszenia (opcjonalnie):", "");
    if(powod === null) return;
    try {
      await apiPut("wnioski.php", {id, akcja: "odrzuc", powod});
      pokazToast("Zgłoszenie odrzucone.");
      await odswiezWszystko();
    } catch(err){
      pokazToast(err.message);
    }
  } else if(akcja === "zwroc"){
    try {
      await apiPut("wnioski.php", {id, akcja: "zwroc"});
      pokazToast("Sprzęt zwrócony, wniosek zamknięty.");
      await odswiezWszystko();
    } catch(err){
      pokazToast(err.message);
    }
  } else if(akcja === "przedluz"){
    const w = stanWnioski.find(x => x.id == id);
    if(!w) return;
    const nowaData = prompt("Nowa data zwrotu (RRRR-MM-DD):", w.dataDo);
    if(!nowaData) return;
    try {
      await apiPut("wnioski.php", {id, akcja: "przedluz", dataDo: nowaData});
      pokazToast("Termin wypożyczenia przedłużony.");
      await odswiezWszystko();
    } catch(err){
      pokazToast(err.message);
    }
  } else if(akcja === "edytujDaty"){
    const w = stanWnioski.find(x => x.id == id);
    if(!w) return;
    const nowaOd = prompt("Data od (RRRR-MM-DD):", w.dataOd);
    if(nowaOd === null) return;
    const nowaDo = prompt("Data do (RRRR-MM-DD):", w.dataDo);
    if(nowaDo === null) return;
    try {
      await apiPut("wnioski.php", {id, akcja: "edytujDaty", dataOd: nowaOd, dataDo: nowaDo});
      pokazToast("Daty zgłoszenia zaktualizowane.");
      await odswiezWszystko();
    } catch(err){
      pokazToast(err.message);
    }
  } else if(akcja === "akceptujPrzedluzenie"){
    try {
      await apiPut("wnioski.php", {id, akcja: "akceptujPrzedluzenie"});
      pokazToast("Przedłużenie zaakceptowane.");
      await odswiezWszystko();
    } catch(err){
      pokazToast(err.message);
    }
  } else if(akcja === "odrzucPrzedluzenie"){
    const powod = prompt("Powód odrzucenia prośby o przedłużenie (opcjonalnie):", "");
    if(powod === null) return;
    try {
      await apiPut("wnioski.php", {id, akcja: "odrzucPrzedluzenie", powod});
      pokazToast("Prośba o przedłużenie odrzucona.");
      await odswiezWszystko();
    } catch(err){
      pokazToast(err.message);
    }
  } else if(akcja === "usunWniosek"){
    if(!confirm("Usunąć ten wniosek bezpowrotnie?")) return;
    try {
      await apiDelete(`wnioski.php?id=${id}`);
      pokazToast("Wniosek usunięty.");
      await odswiezWszystko();
    } catch(err){
      pokazToast(err.message);
    }
  }
});

// Zmiana przypisanego laptopa z listy rozwijanej
document.querySelector("#tabelaWnioski").addEventListener("change", async (e) => {
  const sel = e.target.closest('select[data-action="przypiszLaptop"]');
  if(!sel) return;
  const wniosekId = sel.dataset.id;
  const laptopId = sel.value;
  try {
    await apiPut("wnioski.php", {id: wniosekId, akcja: "przypisz", laptopId});
    pokazToast("Zaktualizowano przypisany laptop.");
    await odswiezWszystko();
  } catch(err){
    pokazToast(err.message);
  }
});

/* ================= POWIADOMIENIA ================= */
async function sprawdzPowiadomienia(){
  if(!sesjaAktualna) return;
  try { 
    await apiGet("sprawdz-powiadomienia.php"); 
  } catch(e){}
}

async function wczytajPowiadomienia(){
  if(trybAktywny === "it"){
    if(!zalogowanyAdmin()){ stanPowiadomienia = []; return; }
    stanPowiadomienia = await apiGet("powiadomienia.php?odbiorca=admin");
  } else {
    const konto = zalogowanyKonto();
    if(!konto){ stanPowiadomienia = []; return; }
    stanPowiadomienia = await apiGet("powiadomienia.php?odbiorca=pracownik");
  }
}

function renderDzwonek(){
  const widoczne = stanPowiadomienia;
  const nieprzeczytane = widoczne.filter(n => !Number(n.przeczytane)).length;
  const badge = document.getElementById("bellBadge");
  if(nieprzeczytane > 0){
    badge.textContent = nieprzeczytane > 9 ? "9+" : nieprzeczytane;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

  const lista = document.getElementById("notifLista");
  if(widoczne.length === 0){
    lista.innerHTML = `<div class="notif-empty">Brak powiadomień.</div>`;
    return;
  }
  lista.innerHTML = widoczne.map(n => `
    <div class="notif-item ${escapeHtml(n.typ)} ${Number(n.przeczytane) ? "" : "unread"}">
      <span class="notif-dot"></span>
      <div class="notif-body">
        <div>${escapeHtml(n.tresc)}</div>
        <div class="notif-meta">
          <span>${formatujDataCzas(n.utworzono)}</span>
          ${Number(n.wyslanoMailem) ? '<span class="mailed">✓ wysłano mailem</span>' : ""}
        </div>
      </div>
      <button class="notif-close" title="Usuń" data-action="usunPowiadomienie" data-id="${n.id}">✕</button>
    </div>
  `).join("");
}

// Delegacja usuwania powiadomień
document.getElementById("notifLista").addEventListener("click", async (e) => {
  const btn = e.target.closest('button[data-action="usunPowiadomienie"]');
  if(!btn) return;
  const id = btn.dataset.id;
  try {
    await apiDelete(`powiadomienia.php?id=${id}`);
    await wczytajPowiadomienia();
    renderDzwonek();
  } catch(e){}
});

document.getElementById("btnOznaczWszystkie").addEventListener("click", async () => {
  const ids = stanPowiadomienia.map(n => n.id);
  if(ids.length === 0) return;
  try {
    await apiPut("powiadomienia.php", {ids});
    await wczytajPowiadomienia();
    renderDzwonek();
  } catch(e){}
});

document.getElementById("btnWyczyscWszystkie").addEventListener("click", async () => {
  if(stanPowiadomienia.length === 0) return;
  if(!confirm("Usunąć wszystkie powiadomienia?")) return;
  try {
    await apiDelete(`powiadomienia.php?ids=${stanPowiadomienia.map(n=>n.id).join(",")}`);
    await wczytajPowiadomienia();
    renderDzwonek();
  } catch(e){}
});

document.getElementById("bellBtn").addEventListener("click", async (e) => {
  e.stopPropagation();
  const dd = document.getElementById("notifDropdown");
  const otwieranie = dd.classList.contains("hidden");
  dd.classList.toggle("hidden");
  if(otwieranie){
    const ids = stanPowiadomienia.filter(n => !Number(n.przeczytane)).map(n => n.id);
    if(ids.length > 0){
      try { 
        await apiPut("powiadomienia.php", {ids}); 
        await wczytajPowiadomienia(); 
      } catch(e){}
    }
    renderDzwonek();
    setTimeout(() => { document.getElementById("bellBadge").classList.add("hidden"); }, 400);
  }
});

document.addEventListener("click", (e) => {
  const dd = document.getElementById("notifDropdown");
  const wrap = document.querySelector(".notif-wrap");
  if(dd && wrap && !dd.classList.contains("hidden") && !wrap.contains(e.target)){
    dd.classList.add("hidden");
  }
});

/* ================= GŁÓWNY CYKL ODŚWIEŻANIA ================= */
async function odswiezWszystko(){
  await wczytajDane();
  renderTabelaSprzet();
  renderTabelaWnioski();
  renderTabelaKonta();
  renderWidokPracownika();
  renderDostepnoscPodglad();
  await sprawdzPowiadomienia();
  await wczytajPowiadomienia();
  renderDzwonek();
}

/* ================= INICJALIZACJA APLIKACJI ================= */
(async function start(){
  // 1. Ustawienie ograniczeń dat w formularzach
  const pOd = document.getElementById("p_od");
  const pDo = document.getElementById("p_do");
  if(pOd) pOd.min = dzisiaj();
  if(pDo) pDo.min = jutro();

  // 2. Pobranie stanu sesji serwera natychmiast po załadowaniu pliku
  await wczytajSesje();

  // 3. Sprawdzenie, czy administrator ma wciąż aktywną sesję
  if(zalogowanyAdmin()){
    document.getElementById("itGate").classList.add("hidden");
    document.getElementById("itPanel").classList.remove("hidden");
  }

  // 4. Pobranie danych i wyrenderowanie interfejsu
  await odswiezWszystko();

  // 5. Okresowe sprawdzanie powiadomień co 5 minut w tle
  setInterval(async () => {
    if(sesjaAktualna){
      await sprawdzPowiadomienia();
      await wczytajPowiadomienia();
      renderDzwonek();
    }
  }, 5 * 60 * 1000);
})();
let csrfToken = "";

async function wczytajSesje(){
  try {
    const d = await apiGet("sesja.php");
    sesjaAktualna = d.zalogowany ? d.konto : null;
    if(d.csrfToken) {
      csrfToken = d.csrfToken;
    }
  } catch(e){
    sesjaAktualna = null;
  }
}

// Dołączanie nagłówka CSRF do żądań mutujących:
async function apiPost(sciezka, dane){
  const res = await fetch(API + sciezka, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken
    },
    body: JSON.stringify(dane)
  });
  const d = await res.json().catch(() => ({}));
  if(!res.ok){ throw new Error(d.blad || "Błąd zapisu."); }
  return d;
}

async function apiPut(sciezka, dane){
  const res = await fetch(API + sciezka, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken
    },
    body: JSON.stringify(dane)
  });
  const d = await res.json().catch(() => ({}));
  if(!res.ok){ throw new Error(d.blad || "Błąd aktualizacji."); }
  return d;
}

async function apiDelete(sciezka){
  const res = await fetch(API + sciezka, { 
    method: "DELETE",
    headers: {
      "X-CSRF-Token": csrfToken
    }
  });
  const d = await res.json().catch(() => ({}));
  if(!res.ok){ throw new Error(d.blad || "Błąd usuwania."); }
  return d;
}// Logowanie pracownika:
document.getElementById("btnZaloguj").addEventListener("click", async function(){
  const email = document.getElementById("log_email").value.trim();
  const haslo = document.getElementById("log_haslo").value;
  const blad = document.getElementById("logowanieBlad");
  blad.classList.add("hidden");

  if(!email || !haslo){
    blad.textContent = "Podaj e-mail i hasło.";
    blad.classList.remove("hidden");
    return;
  }

  this.disabled = true;
  try {
    // Przekazujemy oczekiwanaRola: "pracownik"
    const odp = await apiPost("logowanie.php", { email, haslo, oczekiwanaRola: "pracownik" });
    if(!odp.sukces){
      blad.textContent = odp.blad || "Błąd logowania.";
      blad.classList.remove("hidden");
      return;
    }
    if(odp.csrfToken) csrfToken = odp.csrfToken;
    document.getElementById("log_email").value = "";
    document.getElementById("log_haslo").value = "";
    trybAktywny = "pracownik";
    await wczytajSesje();
    pokazToast(`Zalogowano jako ${sesjaAktualna.imie}.`);
    await odswiezWszystko();
  } catch(e){
    blad.textContent = e.message || "Błąd logowania.";
    blad.classList.remove("hidden");
  } finally {
    this.disabled = false;
  }
});

// Logowanie admina (IT):
async function zalogujIT(){
  const email = document.getElementById("it_email").value.trim();
  const haslo = document.getElementById("it_haslo").value;
  const blad = document.getElementById("itLoginError");
  const btn = document.getElementById("btnItLogin");
  blad.classList.add("hidden");

  if(!email || !haslo){
    blad.textContent = "Podaj e-mail i hasło.";
    blad.classList.remove("hidden");
    return;
  }

  btn.disabled = true;
  try {
    // Przekazujemy oczekiwanaRola: "admin"
    const odp = await apiPost("logowanie.php", { email, haslo, oczekiwanaRola: "admin" });
    if(!odp.sukces){
      blad.textContent = odp.blad || "Błąd logowania.";
      blad.classList.remove("hidden");
      return;
    }
    if(odp.csrfToken) csrfToken = odp.csrfToken;
    document.getElementById("it_email").value = "";
    document.getElementById("it_haslo").value = "";
    await wczytajSesje();
    document.getElementById("itGate").classList.add("hidden");
    document.getElementById("itPanel").classList.remove("hidden");
    pokazToast("Zalogowano do panelu IT.");
    await odswiezWszystko();
  } catch(e){
    blad.textContent = e.message || "Błąd logowania.";
    blad.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

// Algorytm sprawdzania siły hasła
function ocenSileHasla(haslo) {
  let punkty = 0;
  if (!haslo) return { punkty: 0, opis: "", kolor: "#e0e0e0", szerokosc: "0%" };

  if (haslo.length >= 8) punkty++;
  if (haslo.length >= 12) punkty++;
  if (/[A-Z]/.test(haslo)) punkty++;
  if (/[0-9]/.test(haslo)) punkty++;
  if (/[^A-Za-z0-9]/.test(haslo)) punkty++;

  if (punkty <= 2) {
    return { punkty, opis: "Słabe hasło (dodaj dużą literę, cyfrę lub znak)", kolor: "var(--red, #e53e3e)", szerokosc: "33%" };
  } else if (punkty <= 4) {
    return { punkty, opis: "Średnie hasło", kolor: "#dd6b20", szerokosc: "66%" };
  } else {
    return { punkty, opis: "Bardzo silne hasło", kolor: "#38a169", szerokosc: "100%" };
  }
}

function podepnijMiernikSily(idInput, idPasek, idTekst) {
  const input = document.getElementById(idInput);
  const pasek = document.getElementById(idPasek);
  const tekst = document.getElementById(idTekst);
  if (!input || !pasek || !tekst) return;

  input.addEventListener("input", () => {
    const ocena = ocenSileHasla(input.value);
    pasek.style.width = ocena.szerokosc;
    pasek.style.background = ocena.kolor;
    tekst.textContent = ocena.opis;
    tekst.style.color = ocena.kolor;
  });
}

// Podpięcie mierników pod pola haseł
podepnijMiernikSily("zh_p_nowe", "zh_p_sila_pasek", "zh_p_sila_tekst");
podepnijMiernikSily("zh_a_nowe", "zh_a_sila_pasek", "zh_a_sila_tekst");

// Zaktualizowana funkcja zmiany hasła z weryfikacją potwierdzenia
async function zmienHaslo(idObecne, idNowe, idPowtorz, idBlad, idPanel){
  const hasloObecne = document.getElementById(idObecne).value;
  const hasloNowe = document.getElementById(idNowe).value;
  const hasloPowtorz = document.getElementById(idPowtorz).value;
  const blad = document.getElementById(idBlad);
  blad.classList.add("hidden");

  if(!hasloObecne || !hasloNowe || !hasloPowtorz){
    blad.textContent = "Wypełnij wszystkie pola.";
    blad.classList.remove("hidden");
    return;
  }

  if(hasloNowe !== hasloPowtorz){
    blad.textContent = "Wpisane hasła nie są identyczne.";
    blad.classList.remove("hidden");
    return;
  }

  const ocena = ocenSileHasla(hasloNowe);
  if(ocena.punkty < 3){
    blad.textContent = "Nowe hasło jest za słabe. Wymagane min. 8 znaków, w tym duża litera i cyfra.";
    blad.classList.remove("hidden");
    return;
  }

  try {
    await apiPost("zmien-haslo.php", { hasloObecne, hasloNowe, hasloPowtorz });
    document.getElementById(idObecne).value = "";
    document.getElementById(idNowe).value = "";
    document.getElementById(idPowtorz).value = "";
    document.getElementById(idPanel).classList.add("hidden");
    pokazToast("Hasło zostało pomyślnie zmienione.");
  } catch(err){
    blad.textContent = err.message;
    blad.classList.remove("hidden");
  }
}

document.getElementById("btnZmienHasloPracownik").addEventListener("click", async () => {
  await zmienHaslo("zh_p_obecne", "zh_p_nowe", "zh_p_powtorz", "zh_p_blad", "zmianaHaslaPracownikPanel");
});

document.getElementById("btnZmienHasloAdmin").addEventListener("click", async () => {
  await zmienHaslo("zh_a_obecne", "zh_a_nowe", "zh_a_powtorz", "zh_a_blad", "zmianaHaslaAdminPanel");
});
