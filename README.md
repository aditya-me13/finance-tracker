# Finance Tracker

A personal finance tracker that runs in the browser as an installable app (a PWA). It's built for Indian money: amounts in ₹ and an April–March financial year.

## What it does

- **Expenses, income and transfers** across bank accounts, credit cards and cash, with categories and tags
- **Budgets** for the whole month or per category, and a weekly view
- **Credit cards** with due-date reminders, auto-debit and overdue alerts
- **Loans and EMIs**, plus **recurring payments** that are logged automatically, with reminders before each one
- **Investments** (stocks, ETFs and mutual funds) with live prices
- **Roommate splits**, Splitwise-style: track who owes whom and settle up
- **Analytics**: cash flow, category breakdowns, net-worth trend and savings rate
- Cloud sync through Firebase, offline support, dark mode and keyboard shortcuts

## Run it

There's nothing to install and no build step. Serve the folder and open it:

```bash
python3 -m http.server
```

Then go to `http://localhost:8000`. The offline mode needs `localhost` or HTTPS, so opening `index.html` straight from your files (`file://`) won't work.

## Built with

Plain JavaScript, HTML and CSS · Chart.js · Firebase (sign-in and data sync)

## Keyboard shortcuts

| Key | Action |
|---|---|
| `N` | New expense |
| `/` | Search transactions |
| `Ctrl/Cmd + B` | Show / hide the sidebar |
| `Esc` | Close the open dialog |
