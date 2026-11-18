const formatDate = (value) => new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
}).format(new Date(value));

const setMessage = (element, message, isError = false) => {
    element.textContent = message;
    element.classList.toggle("error", isError);
};

const loadCurrentPhrase = async () => {
    const response = await fetch("/api/phrases/current");
    if (!response.ok) {
        throw new Error("Não foi possível carregar a frase.");
    }

    return (await response.json()).phrase;
};

const loadHome = async () => {
    const date = document.querySelector("#data-frase");
    const phrase = document.querySelector("#frase");

    try {
        const current = await loadCurrentPhrase();
        date.textContent = formatDate(current.createdAt);
        phrase.textContent = current.text;
    } catch (error) {
        date.textContent = "";
        phrase.textContent = error.message;
    }
};

const loadHistory = async () => {
    const list = document.querySelector("#historico");

    try {
        const response = await fetch("/api/phrases/history");
        if (!response.ok) {
            throw new Error("Não foi possível carregar o histórico.");
        }

        const { phrases } = await response.json();
        list.replaceChildren();

        if (phrases.length === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.textContent = "Ainda não há frases anteriores.";
            list.append(emptyMessage);
            return;
        }

        for (const phrase of phrases) {
            const card = document.createElement("article");
            card.className = "frases history-entry";

            const date = document.createElement("p");
            date.textContent = formatDate(phrase.createdAt);

            const text = document.createElement("h2");
            text.className = "frase";
            text.textContent = phrase.text;

            const signature = document.createElement("p");
            signature.className = "com-amor";
            signature.textContent = "com muito amor: Guilherme";

            card.append(date, text, signature);
            list.append(card);
        }
    } catch (error) {
        list.textContent = error.message;
    }
};

const setupLogin = () => {
    const form = document.querySelector("#login-form");
    const message = document.querySelector("#form-message");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button");
        button.disabled = true;
        setMessage(message, "");

        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: form.elements.password.value }),
            });

            if (response.status === 401) {
                setMessage(message, "Senha incorreta. Tente novamente.", true);
                return;
            }
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || "Não foi possível verificar a senha. Tente novamente.");
            }

            window.location.assign("/editar.html");
        } catch (error) {
            setMessage(message, error.message, true);
        } finally {
            button.disabled = false;
        }
    });
};

const setupEditor = async () => {
    const form = document.querySelector("#phrase-form");
    const message = document.querySelector("#form-message");
    const currentPhrase = document.querySelector("#current-phrase");

    try {
        const current = await loadCurrentPhrase();
        currentPhrase.textContent = `Frase atual: “${current.text}”`;
    } catch (error) {
        currentPhrase.textContent = error.message;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button");
        button.disabled = true;
        setMessage(message, "");

        try {
            const response = await fetch("/api/phrases", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: form.elements.phrase.value }),
            });

            if (response.status === 401) {
                window.location.assign("/senha.html");
                return;
            }
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || "Não foi possível salvar a frase.");
            }

            const { phrase } = await response.json();
            currentPhrase.textContent = `Frase atual: “${phrase.text}”`;
            form.reset();
            setMessage(message, "Frase atualizada. A frase anterior foi salva no histórico.");
        } catch (error) {
            setMessage(message, error.message, true);
        } finally {
            button.disabled = false;
        }
    });

    document.querySelector("#logout-button").addEventListener("click", async () => {
        await fetch("/api/logout", { method: "POST" });
        window.location.assign("/index.html");
    });
};

const page = document.body.dataset.page;
if (page === "home") loadHome();
if (page === "history") loadHistory();
if (page === "login") setupLogin();
if (page === "edit") setupEditor();
