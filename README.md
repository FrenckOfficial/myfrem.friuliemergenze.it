# MyFrEM

> Piattaforma ufficiale della community di Friuli Emergenze.

MyFrEM (**My Friuli Emergenze**) è una piattaforma web sviluppata per centralizzare le attività della community di Friuli Emergenze, consentendo agli utenti di interagire, condividere contenuti e partecipare alle iniziative del progetto.

## 🚀 Caratteristiche

* 👤 Sistema di autenticazione utenti
* 📸 Upload e gestione delle fotografie
* 📰 Gestione dei contenuti della community
* 📅 Gestione degli eventi
* 🔔 Sistema di notifiche
* 🛡️ Pannello di amministrazione
* 📱 Interfaccia responsive
* 🌐 Integrazione con i servizi di Friuli Emergenze

## 🏗️ Architettura

MyFrEM è progettato per essere modulare, scalabile e facilmente estendibile.

### Moduli principali

* **Authentication** → gestione degli account utente
* **Profiles** → profili e impostazioni personali
* **Media** → caricamento e gestione delle immagini
* **Events** → gestione degli eventi
* **Community** → interazioni tra gli utenti
* **Admin Panel** → strumenti di moderazione e amministrazione

## ⚙️ Installazione

Clonare il repository:

```bash
git clone https://github.com/FrenckOfficial/myfrem.friuliemergenze.it.git
```

Entrare nella cartella del progetto:

```bash
cd myfrem
```

Installare le dipendenze:

```bash
npm install
```

Avviare il server di sviluppo (è obbligatoria l'installazione di NGINX):

```bash
nginx http 3000
```

## 🛠️ Configurazione

Creare un file `.env`:

```env
BREVO_API_KEY=

FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
GITHUB_PAT=

```

## 📂 Struttura del progetto

```text
myfrem.friuliemergenze.it/
├── .github/workflows/
├── .well-known/
├── api/
├── assets/
├── auth/
├── dashboard/
├── events/
├── kick-reports/
├── login/
├── node_modules/
├── profile/
├── riunione-staff/
├── staff/
├── verify-email/
├── configFirebase.js
├── configSupabase.js
├── humans.txt
├── index.html
├── manifest.json
├── package-lock.json
├── package.json
├── README.md
├── robots.txt
├── sitemap.xml
└── style.css
```

## 🔒 Sicurezza

MyFrEM adotta diverse misure di sicurezza:

* Protezione delle sessioni utente
* Controllo dei permessi
* Validazione degli input
* Protezione contro richieste malevole
* Moderazione dei contenuti caricati

## 🗺️ Roadmap

* [ ] Sistema di messaggistica interna
* [ ] Badge per gli utenti
* [ ] Sistema di segnalazioni
* [ ] Dashboard statistiche
* [ ] Applicazione mobile
* [ ] API pubblica

## 👨‍💻 Team

**Friuli Emergenze**

* Francesco Vio — Fondatore e amministratore (dal 2025)

## 🔗 Link

* 🌐 https://friuliemergenze.it
* 🖥️ https://myfrem.friuliemergenze.it
* 📸 Instagram: @friuliemergenze
* 🎵 TikTok: @friuliemergenze

## 📄 Licenza

Copyright © 2025-2026 Friuli Emergenze.

Tutti i diritti riservati.