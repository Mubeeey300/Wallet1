document.addEventListener("DOMContentLoaded", () => {
"use strict";

/* ==================================
   STORAGE KEYS
================================== */

const STORAGE_KEYS = {
    wallets: "mpocket_wallets",
    transactions: "mpocket_transactions",
    currentWallet: "mpocket_current_wallet",
    theme: "mpocket_theme",
    pin: "mpocket_pin",
    profileName: "mpocket_profile_name"
};


/* ==================================
   DOM HELPERS
================================== */

const $ = (selector) => document.querySelector(selector);

const readStorage = (key, fallback) => {
    try {
        const value = localStorage.getItem(key);

        if (value === null) {
            return fallback;
        }

        return JSON.parse(value);
    } catch (error) {
        console.error(`Unable to read ${key}:`, error);
        return fallback;
    }
};

const writeStorage = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`Unable to save ${key}:`, error);
        showMessage("Unable to save data in this browser.", "error");
        return false;
    }
};

const formatNaira = (amount) => {
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(amount) || 0);
};

const formatDate = (dateValue) => {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return date.toLocaleString("en-NG", {
        dateStyle: "medium",
        timeStyle: "short"
    });
};

const escapeHTML = (value) => {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
};

const iconHTML = (icon, extraClass = "") => {
    return `<i class="bi ${icon}${extraClass ? ` ${extraClass}` : ""}" aria-hidden="true"></i>`;
};


/* ==================================
   NOTIFICATIONS
================================== */

let toastTimer;

function showMessage(message, type = "success") {
    const toast = $("#toast");

    if (!toast) {
        return;
    }

    clearTimeout(toastTimer);

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    toastTimer = setTimeout(() => {
        toast.className = "toast";
    }, 3000);
}


/* ==================================
   LOAD OR CREATE DATA
================================== */

let wallets = readStorage(STORAGE_KEYS.wallets, []);
let transactions = readStorage(STORAGE_KEYS.transactions, []);

if (!Array.isArray(wallets)) {
    wallets = [];
}

if (!Array.isArray(transactions)) {
    transactions = [];
}

let currentWalletId = localStorage.getItem(
    STORAGE_KEYS.currentWallet
);

let balanceHidden = false;

function saveWallets() {
    return writeStorage(STORAGE_KEYS.wallets, wallets);
}

function saveTransactions() {
    return writeStorage(STORAGE_KEYS.transactions, transactions);
}

function saveCurrentWallet() {
    if (currentWalletId) {
        localStorage.setItem(
            STORAGE_KEYS.currentWallet,
            currentWalletId
        );
    }
}

function getCurrentWallet() {
    return wallets.find(
        (wallet) => wallet.id === currentWalletId
    ) || wallets[0] || null;
}

function generateWalletId() {
    let newId;

    do {
        newId = `MP-${Math.floor(10000 + Math.random() * 90000)}`;
    } while (wallets.some((wallet) => wallet.id === newId));

    return newId;
}

function createInitialWallet() {
    const wallet = {
        id: "MP-10001",
        owner: "Mubeeey",
        balance: 50000,
        createdAt: new Date().toISOString()
    };

    wallets.push(wallet);
    currentWalletId = wallet.id;

    saveWallets();
    saveCurrentWallet();

    return wallet;
}

if (wallets.length === 0) {
    createInitialWallet();
}

if (!wallets.some((wallet) => wallet.id === currentWalletId)) {
    currentWalletId = wallets[0].id;
    saveCurrentWallet();
}

const firstWallet = getCurrentWallet();

if (!localStorage.getItem(STORAGE_KEYS.profileName)) {
    localStorage.setItem(
        STORAGE_KEYS.profileName,
        firstWallet?.owner || "Mubeeey"
    );
}


/* ==================================
   PROFILE
================================== */

function getProfileName() {
    return (
        localStorage.getItem(STORAGE_KEYS.profileName) ||
        getCurrentWallet()?.owner ||
        "Mubeeey"
    );
}

function renderProfile() {
    const currentWallet = getCurrentWallet();

    $("#profileName").value = getProfileName();
    $("#profileDisplayName").textContent = getProfileName();

    $("#profileAvatar").textContent =
        getProfileName().trim().charAt(0).toUpperCase() || "M";

    $("#profileWalletId").textContent =
        currentWallet?.id || "No wallet";

    $("#profileWalletCount").textContent = wallets.length;
    $("#profileTransactionCount").textContent = transactions.length;
}

function openProfile() {
    hideAllForms();

    $("#profileSection").classList.remove("hidden");

    renderProfile();

    $("#profileSection").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

$("#profileBtn").addEventListener("click", openProfile);

$("#closeProfileBtn").addEventListener("click", () => {
    $("#profileSection").classList.add("hidden");
});

$("#profileForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const newName = $("#profileName").value.trim();

    if (!newName) {
        showMessage("Please enter your name.", "error");
        return;
    }

    if (newName.length > 40) {
        showMessage("Your name is too long.", "error");
        return;
    }

    localStorage.setItem(STORAGE_KEYS.profileName, newName);

    const currentWallet = getCurrentWallet();

    if (currentWallet) {
        currentWallet.owner = newName;
        saveWallets();
    }

    renderDashboard();
    renderProfile();

    showMessage("Your profile has been updated.");
});


/* ==================================
   SECURITY PIN
================================== */

let securityMode = "setup";
let isUnlocked = false;

function showSecurityGate(mode) {
    securityMode = mode;

    const isSetup = mode === "setup";

    $("#securityTitle").textContent = isSetup
        ? "Create Your PIN"
        : "Unlock Your Wallet";

    $("#securityDescription").textContent = isSetup
        ? "Create a 4–6 digit PIN for this demo wallet."
        : "Enter your PIN to continue.";

    $("#securitySubmit").innerHTML = isSetup
        ? `${iconHTML("bi-shield-lock-fill")} Create PIN & Continue`
        : `${iconHTML("bi-unlock-fill")} Unlock Wallet`;

    $("#confirmPinGroup").classList.toggle("hidden", !isSetup);
    $("#confirmPinInput").required = isSetup;

    $("#pinInput").value = "";
    $("#confirmPinInput").value = "";
    $("#securityError").textContent = "";

    $("#securityModal").classList.remove("hidden");

    $("#pinInput").focus();
}

function lockWallet() {
    isUnlocked = false;

    $("#receiptModal").classList.add("hidden");

    showSecurityGate("unlock");
}

$("#lockBtn").addEventListener("click", lockWallet);

$("#securityForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const pin = $("#pinInput").value.trim();
    const confirmation = $("#confirmPinInput").value.trim();

    const pinPattern = /^\d{4,6}$/;

    if (!pinPattern.test(pin)) {
        $("#securityError").textContent =
            "Your PIN must contain 4–6 digits.";
        return;
    }

    const storedPin = localStorage.getItem(STORAGE_KEYS.pin);

    if (securityMode === "setup" && !storedPin) {
        if (pin !== confirmation) {
            $("#securityError").textContent =
                "The PINs do not match.";
            return;
        }

        localStorage.setItem(STORAGE_KEYS.pin, pin);

        isUnlocked = true;

        $("#securityModal").classList.add("hidden");

        showMessage("Your demo PIN has been created.");

        return;
    }

    if (!storedPin) {
        showSecurityGate("setup");
        return;
    }

    if (pin !== storedPin) {
        $("#securityError").textContent =
            "Incorrect PIN. Please try again.";

        $("#pinInput").value = "";
        $("#pinInput").focus();

        return;
    }

    isUnlocked = true;

    $("#securityModal").classList.add("hidden");

    showMessage("Wallet unlocked.");
});


/* ==================================
   CHANGE PIN
================================== */

$("#changePinForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const currentPin = $("#currentPin").value.trim();
    const newPin = $("#newPin").value.trim();
    const confirmation = $("#confirmNewPin").value.trim();

    const storedPin = localStorage.getItem(STORAGE_KEYS.pin);
    const pinPattern = /^\d{4,6}$/;

    const message = $("#pinSettingsMessage");

    message.className = "form-message";
    message.textContent = "";

    if (!storedPin) {
        message.textContent =
            "Create a PIN before attempting to change it.";

        message.classList.add("error");
        return;
    }

    if (currentPin !== storedPin) {
        message.textContent = "Your current PIN is incorrect.";
        message.classList.add("error");
        return;
    }

    if (!pinPattern.test(newPin)) {
        message.textContent =
            "Your new PIN must contain 4–6 digits.";

        message.classList.add("error");
        return;
    }

    if (newPin !== confirmation) {
        message.textContent =
            "The new PIN and confirmation do not match.";

        message.classList.add("error");
        return;
    }

    if (newPin === currentPin) {
        message.textContent =
            "Choose a different PIN from your current one.";

        message.classList.add("error");
        return;
    }

    localStorage.setItem(STORAGE_KEYS.pin, newPin);

    $("#currentPin").value = "";
    $("#newPin").value = "";
    $("#confirmNewPin").value = "";

    message.textContent = "Your PIN has been changed successfully.";
    message.classList.add("success");
});


/* ==================================
   THEME
================================== */

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);

    const themeIcon = $("#themeToggle").querySelector("i");

    if (themeIcon) {
        themeIcon.className = theme === "dark"
            ? "bi bi-sun-fill"
            : "bi bi-moon-stars-fill";
    }

    $("#themeToggle").setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );

    $("#themeToggle").setAttribute(
        "title",
        theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"
    );

    localStorage.setItem(STORAGE_KEYS.theme, theme);
}

const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);

applyTheme(savedTheme === "dark" ? "dark" : "light");

$("#themeToggle").addEventListener("click", () => {
    const currentTheme =
        document.documentElement.getAttribute("data-theme");

    applyTheme(currentTheme === "dark" ? "light" : "dark");
});


/* ==================================
   FORMS AND PANELS
================================== */

function hideAllForms() {
    [
        "#sendSection",
        "#createSection",
        "#receiveSection"
    ].forEach((selector) => {
        $(selector).classList.add("hidden");
    });
}

function toggleForm(selector) {
    const section = $(selector);
    const shouldOpen = section.classList.contains("hidden");

    hideAllForms();

    if (shouldOpen) {
        section.classList.remove("hidden");

        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

$("#sendBtn").addEventListener("click", () => {
    toggleForm("#sendSection");
});

$("#createBtn").addEventListener("click", () => {
    toggleForm("#createSection");
});

$("#receiveBtn").addEventListener("click", () => {
    toggleForm("#receiveSection");
    updateReceiveDetails();
});

document.querySelectorAll(".close-form").forEach((button) => {
    button.addEventListener("click", () => {
        hideAllForms();
    });
});


/* ==================================
   CREATE WALLET
================================== */

$("#createForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const owner = $("#walletOwner").value.trim();
    const startingBalance = Number($("#startingBalance").value);

    if (!owner) {
        showMessage("Please enter the wallet owner's name.", "error");
        return;
    }

    if (!Number.isFinite(startingBalance) || startingBalance < 0) {
        showMessage("Enter a valid starting balance.", "error");
        return;
    }

    const wallet = {
        id: generateWalletId(),
        owner,
        balance: startingBalance,
        createdAt: new Date().toISOString()
    };

    wallets.push(wallet);
    currentWalletId = wallet.id;

    saveWallets();
    saveCurrentWallet();

    $("#createForm").reset();
    $("#startingBalance").value = "0";

    hideAllForms();
    renderDashboard();
    renderProfile();

    showMessage(`Wallet ${wallet.id} created successfully.`);
});


/* ==================================
   SEND MONEY
================================== */

$("#sendForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const sender = getCurrentWallet();

    if (!sender) {
        showMessage("Please select a wallet first.", "error");
        return;
    }

    const recipientId = $("#recipientWallet").value
        .trim()
        .toUpperCase();

    const amount = Number($("#sendAmount").value);
    const note = $("#sendNote").value.trim();

    if (!recipientId) {
        showMessage("Enter the recipient's wallet ID.", "error");
        return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        showMessage("Enter an amount greater than zero.", "error");
        return;
    }

    if (recipientId === sender.id) {
        showMessage("You cannot send money to the same wallet.", "error");
        return;
    }

    const recipient = wallets.find(
        (wallet) => wallet.id.toUpperCase() === recipientId
    );

    if (!recipient) {
        showMessage(
            "Recipient wallet not found in this browser.",
            "error"
        );
        return;
    }

    if (sender.balance < amount) {
        showMessage("Insufficient wallet balance.", "error");
        return;
    }

    sender.balance = Number(
        (sender.balance - amount).toFixed(2)
    );

    recipient.balance = Number(
        (recipient.balance + amount).toFixed(2)
    );

    const transferId =
        "TR-" +
        Date.now().toString() +
        "-" +
        Math.floor(100 + Math.random() * 900);

    const timestamp = new Date().toISOString();

    const sentTransaction = {
        id: `${transferId}-S`,
        transferId,
        type: "sent",
        walletId: sender.id,
        otherWalletId: recipient.id,
        otherOwner: recipient.owner,
        amount,
        note,
        date: timestamp
    };

    const receivedTransaction = {
        id: `${transferId}-R`,
        transferId,
        type: "received",
        walletId: recipient.id,
        otherWalletId: sender.id,
        otherOwner: sender.owner,
        amount,
        note,
        date: timestamp
    };

    transactions.unshift(sentTransaction, receivedTransaction);

    saveWallets();
    saveTransactions();

    $("#sendForm").reset();

    hideAllForms();
    renderDashboard();
    renderProfile();

    showMessage(
        `${formatNaira(amount)} sent to ${recipient.owner}.`
    );

    openReceipt(sentTransaction.id);
});


/* ==================================
   WALLET LIST
================================== */

function renderWallets() {
    const container = $("#walletList");

    if (!wallets.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-wallet2" aria-hidden="true"></i>
                <strong>No wallets yet</strong>
                Create a wallet to get started.
            </div>
        `;
        return;
    }

    container.innerHTML = wallets.map((wallet) => {
        const isCurrent = wallet.id === currentWalletId;

        return `
            <article class="wallet-item ${isCurrent ? "active" : ""}">
                <div class="wallet-item-top">
                    <div>
                        <h3>
                            <i class="bi bi-wallet2" aria-hidden="true"></i>
                            ${escapeHTML(wallet.owner)}
                        </h3>
                        <p>
                            <i class="bi bi-credit-card" aria-hidden="true"></i>
                            ${escapeHTML(wallet.id)}
                        </p>
                    </div>

                    ${
                        isCurrent
                            ? `<span class="active-label">
                                <i class="bi bi-check-circle-fill" aria-hidden="true"></i>
                                SELECTED
                               </span>`
                            : ""
                    }
                </div>

                <div class="wallet-balance">
                    ${balanceHidden ? "••••••••" : formatNaira(wallet.balance)}
                </div>

                <button
                    class="wallet-select"
                    type="button"
                    data-wallet-id="${escapeHTML(wallet.id)}"
                    ${isCurrent ? "disabled" : ""}
                >
                    <i class="bi ${isCurrent ? "bi-check-circle-fill" : "bi-wallet2"}"
                       aria-hidden="true"></i>
                    ${isCurrent ? "Current Wallet" : "Select Wallet"}
                </button>
            </article>
        `;
    }).join("");
}

$("#walletList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-wallet-id]");

    if (!button) {
        return;
    }

    const walletId = button.dataset.walletId;

    if (!wallets.some((wallet) => wallet.id === walletId)) {
        showMessage("Wallet not found.", "error");
        return;
    }

    currentWalletId = walletId;
    saveCurrentWallet();

    renderDashboard();
    renderProfile();

    showMessage("Wallet selected.");
});


/* ==================================
   RECEIVE MONEY
================================== */

function updateReceiveDetails() {
    const wallet = getCurrentWallet();

    $("#receiveId").textContent = wallet?.id || "No wallet";
}

$("#copyBtn").addEventListener("click", async () => {
    const wallet = getCurrentWallet();

    if (!wallet) {
        showMessage("No wallet selected.", "error");
        return;
    }

    try {
        await navigator.clipboard.writeText(wallet.id);
        showMessage("Wallet ID copied.");
    } catch (error) {
        const temporaryInput = document.createElement("textarea");

        temporaryInput.value = wallet.id;
        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";

        document.body.appendChild(temporaryInput);
        temporaryInput.select();

        let copied = false;

        try {
            copied = document.execCommand("copy");
        } catch (copyError) {
            copied = false;
        }

        temporaryInput.remove();

        if (copied) {
            showMessage("Wallet ID copied.");
        } else {
            showMessage(
                "Copy failed. Please copy the wallet ID manually.",
                "error"
            );
        }
    }
});


/* ==================================
   BALANCE VISIBILITY
================================== */

$("#toggleBalance").addEventListener("click", () => {
    balanceHidden = !balanceHidden;

    const balanceIcon = $("#toggleBalance").querySelector("i");

    if (balanceIcon) {
        balanceIcon.className = balanceHidden
            ? "bi bi-eye-fill"
            : "bi bi-eye-slash-fill";
    }

    $("#toggleBalance").setAttribute(
        "aria-label",
        balanceHidden ? "Show balance" : "Hide balance"
    );

    $("#toggleBalance").setAttribute(
        "title",
        balanceHidden ? "Show Balance" : "Hide Balance"
    );

    renderDashboard();
});


/* ==================================
   TRANSACTION SEARCH
================================== */

function getCurrentWalletTransactions() {
    const wallet = getCurrentWallet();

    if (!wallet) {
        return [];
    }

    return transactions
        .filter((transaction) => transaction.walletId === wallet.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderTransactions() {
    const container = $("#transactionList");
    const searchValue = $("#transactionSearch").value
        .trim()
        .toLowerCase();

    const allWalletTransactions = getCurrentWalletTransactions();

    const filteredTransactions = allWalletTransactions.filter(
        (transaction) => {
            const searchableText = [
                transaction.id,
                transaction.transferId,
                transaction.type,
                transaction.otherWalletId,
                transaction.otherOwner,
                transaction.note,
                transaction.amount,
                formatDate(transaction.date)
            ].join(" ").toLowerCase();

            return searchableText.includes(searchValue);
        }
    );

    $("#searchResults").textContent =
        `${filteredTransactions.length} transaction` +
        `${filteredTransactions.length === 1 ? "" : "s"} found`;

    if (!filteredTransactions.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-receipt" aria-hidden="true"></i>
                <strong>No transactions found</strong>
                ${
                    searchValue
                        ? "Try another search term."
                        : "Your transactions will appear here."
                }
            </div>
        `;
        return;
    }

    container.innerHTML = filteredTransactions.map((transaction) => {
        const isSent = transaction.type === "sent";

        const heading = isSent
            ? `Sent to ${transaction.otherOwner || transaction.otherWalletId}`
            : `Received from ${transaction.otherOwner || transaction.otherWalletId}`;

        const amountPrefix = isSent ? "−" : "+";

        const directionIcon = isSent
            ? "bi-arrow-up-right"
            : "bi-arrow-down-left";

        const typeIcon = isSent
            ? "bi-send-fill"
            : "bi-download";

        return `
            <article class="transaction-item">
                <div class="transaction-main">
                    <div class="transaction-icon ${isSent ? "sent" : "received"}">
                        <i class="bi ${directionIcon}" aria-hidden="true"></i>
                    </div>

                    <div class="transaction-details">
                        <h3>
                            <i class="bi ${typeIcon}" aria-hidden="true"></i>
                            ${escapeHTML(heading)}
                        </h3>

                        <p>
                            <i class="bi bi-clock" aria-hidden="true"></i>
                            ${escapeHTML(formatDate(transaction.date))}
                        </p>

                        ${
                            transaction.note
                                ? `<p>
                                    <i class="bi bi-chat-left-text" aria-hidden="true"></i>
                                    ${escapeHTML(transaction.note)}
                                   </p>`
                                : ""
                        }

                        <p>
                            <i class="bi bi-credit-card" aria-hidden="true"></i>
                            Wallet: ${escapeHTML(transaction.otherWalletId || "—")}
                        </p>
                    </div>
                </div>

                <div class="transaction-side">
                    <span class="transaction-amount ${isSent ? "sent" : "received"}">
                        ${amountPrefix}${formatNaira(transaction.amount)}
                    </span>

                    <button
                        class="receipt-link"
                        type="button"
                        data-receipt-id="${escapeHTML(transaction.id)}"
                    >
                        <i class="bi bi-receipt" aria-hidden="true"></i>
                        View Receipt
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

$("#transactionSearch").addEventListener("input", renderTransactions);

$("#clearSearch").addEventListener("click", () => {
    $("#transactionSearch").value = "";
    renderTransactions();
});

$("#transactionList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-receipt-id]");

    if (!button) {
        return;
    }

    openReceipt(button.dataset.receiptId);
});


/* ==================================
   RECEIPTS
================================== */

function openReceipt(transactionId) {
    const transaction = transactions.find(
        (item) => item.id === transactionId
    );

    if (!transaction) {
        showMessage("Transaction receipt not found.", "error");
        return;
    }

    const wallet = wallets.find(
        (item) => item.id === transaction.walletId
    );

    const isSent = transaction.type === "sent";

    const transactionLabel = isSent ? "Money Sent" : "Money Received";

    const otherPartyLabel = isSent ? "Recipient" : "Sender";

    const amountPrefix = isSent ? "−" : "+";

    const receiptIcon = isSent
        ? "bi-arrow-up-right-circle-fill"
        : "bi-arrow-down-left-circle-fill";

    $("#receiptContent").innerHTML = `
        <div class="receipt-amount">
            <span>
                <i class="bi ${receiptIcon}" aria-hidden="true"></i>
                ${transactionLabel}
            </span>
            <strong>${amountPrefix}${formatNaira(transaction.amount)}</strong>
        </div>

        <div class="receipt-row">
            <span><i class="bi bi-check-circle-fill" aria-hidden="true"></i> Status</span>
            <strong>Demo Successful</strong>
        </div>

        <div class="receipt-row">
            <span><i class="bi bi-hash" aria-hidden="true"></i> Transaction ID</span>
            <strong>${escapeHTML(transaction.transferId || transaction.id)}</strong>
        </div>

        <div class="receipt-row">
            <span><i class="bi bi-calendar-event" aria-hidden="true"></i> Date</span>
            <strong>${escapeHTML(formatDate(transaction.date))}</strong>
        </div>

        <div class="receipt-row">
            <span><i class="bi bi-person" aria-hidden="true"></i> Wallet Owner</span>
            <strong>${escapeHTML(wallet?.owner || "Unknown")}</strong>
        </div>

        <div class="receipt-row">
            <span><i class="bi bi-wallet2" aria-hidden="true"></i> Wallet ID</span>
            <strong>${escapeHTML(transaction.walletId)}</strong>
        </div>

        <div class="receipt-row">
            <span><i class="bi bi-person-check" aria-hidden="true"></i> ${otherPartyLabel}</span>
            <strong>${escapeHTML(transaction.otherOwner || "Unknown")}</strong>
        </div>

        <div class="receipt-row">
            <span><i class="bi bi-credit-card" aria-hidden="true"></i> Other Wallet ID</span>
            <strong>${escapeHTML(transaction.otherWalletId || "—")}</strong>
        </div>

        <div class="receipt-row">
            <span><i class="bi bi-chat-left-text" aria-hidden="true"></i> Description</span>
            <strong>${escapeHTML(transaction.note || "No description")}</strong>
        </div>

        <p class="muted small-text" style="margin: 18px 0 0; text-align: center;">
            <i class="bi bi-info-circle" aria-hidden="true"></i>
            This receipt belongs to a local wallet demonstration.
            It is not proof of a real financial transaction.
        </p>
    `;

    $("#receiptModal").classList.remove("hidden");
}

function closeReceipt() {
    $("#receiptModal").classList.add("hidden");
}

$("#closeReceipt").addEventListener("click", closeReceipt);

$("#closeReceiptBottom").addEventListener("click", closeReceipt);

$("#receiptOverlay").addEventListener("click", closeReceipt);

$("#printReceipt").addEventListener("click", () => {
    window.print();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        if (!$("#receiptModal").classList.contains("hidden")) {
            closeReceipt();
        }
    }
});


/* ==================================
   ANALYTICS
================================== */

function renderAnalytics() {
    const wallet = getCurrentWallet();

    const walletTransactions = getCurrentWalletTransactions();

    const sentTransactions = walletTransactions.filter(
        (transaction) => transaction.type === "sent"
    );

    const receivedTransactions = walletTransactions.filter(
        (transaction) => transaction.type === "received"
    );

    const totalSent = sentTransactions.reduce(
        (total, transaction) => total + Number(transaction.amount || 0),
        0
    );

    const totalReceived = receivedTransactions.reduce(
        (total, transaction) => total + Number(transaction.amount || 0),
        0
    );

    $("#totalSent").textContent = formatNaira(totalSent);
    $("#totalReceived").textContent = formatNaira(totalReceived);

    $("#totalTransactions").textContent = walletTransactions.length;
    $("#totalWallets").textContent = wallets.length;

    $("#sentChartValue").textContent = formatNaira(totalSent);
    $("#receivedChartValue").textContent = formatNaira(totalReceived);

    const maxValue = Math.max(totalSent, totalReceived, 1);

    const sentPercentage = (totalSent / maxValue) * 100;
    const receivedPercentage = (totalReceived / maxValue) * 100;

    $("#sentChartBar").style.width = `${sentPercentage}%`;
    $("#receivedChartBar").style.width = `${receivedPercentage}%`;

    if (!wallet) {
        $("#totalSent").textContent = formatNaira(0);
        $("#totalReceived").textContent = formatNaira(0);
    }
}


/* ==================================
   DASHBOARD RENDERING
================================== */

function renderDashboard() {
    const wallet = getCurrentWallet();

    if (wallet) {
        $("#balance").textContent = balanceHidden
            ? "••••••••"
            : formatNaira(wallet.balance);

        $("#walletId").textContent = wallet.id;
        $("#receiveId").textContent = wallet.id;
    } else {
        $("#balance").textContent = formatNaira(0);
        $("#walletId").textContent = "No wallet";
        $("#receiveId").textContent = "No wallet";
    }

    $("#welcomeName").textContent = getProfileName();

    renderWallets();
    renderTransactions();
    renderAnalytics();
}


/* ==================================
   INITIAL SETUP
================================== */

$("#currentYear").textContent = new Date().getFullYear();

renderDashboard();
renderProfile();

const savedPin = localStorage.getItem(STORAGE_KEYS.pin);

if (!savedPin) {
    showSecurityGate("setup");
} else {
    showSecurityGate("unlock");
}

});
