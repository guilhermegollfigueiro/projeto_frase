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

const setupPhotoCarousel = () => {
    const image = document.querySelector("#foto-carousel");
    if (!image) {
        return;
    }

    const photos = Array.from({ length: 7 }, (_, index) => `/assets/foto${index + 1}.jpeg`);
    const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hourCycle: "h23",
    });
    const firstPhotoDate = Date.UTC(2026, 10, 18);

    photos.forEach((source) => {
        const preload = new Image();
        preload.src = source;
    });

    const getDateTime = () => Object.fromEntries(
        dateTimeFormatter.formatToParts(new Date())
            .filter(({ type }) => type !== "literal")
            .map(({ type, value }) => [type, Number(value)]),
    );

    const updatePhotoForToday = () => {
        const { year, month, day } = getDateTime();
        const today = Date.UTC(year, month - 1, day);
        const daysSinceFirstPhoto = Math.floor((today - firstPhotoDate) / 86_400_000);
        const photoIndex = ((daysSinceFirstPhoto % photos.length) + photos.length) % photos.length;
        const source = photos[photoIndex];

        if (image.getAttribute("src") === source) {
            return;
        }

        image.classList.add("is-changing");
        window.setTimeout(() => {
            image.src = source;
            image.alt = `Foto ${photoIndex + 1} do carrossel`;
            image.classList.remove("is-changing");
        }, 250);
    };

    const scheduleNextMidnight = () => {
        const { hour, minute, second } = getDateTime();
        const secondsUntilMidnight = 86_400 - (hour * 3_600 + minute * 60 + second);
        const delay = secondsUntilMidnight * 1_000 - new Date().getMilliseconds();

        window.setTimeout(() => {
            updatePhotoForToday();
            scheduleNextMidnight();
        }, delay);
    };

    updatePhotoForToday();
    scheduleNextMidnight();
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

const setupSiteLogin = () => {
    const form = document.querySelector("#site-login-form");
    const message = document.querySelector("#site-login-message");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button");
        button.disabled = true;
        setMessage(message, "");

        try {
            const response = await fetch("/api/site-login", {
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
                throw new Error(result.error || "Não foi possível verificar a senha.");
            }

            window.location.assign("/index.html");
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
    const historyForm = document.querySelector("#history-phrase-form");
    const historyMessage = document.querySelector("#history-form-message");

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

    historyForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = historyForm.querySelector("button");
        button.disabled = true;
        setMessage(historyMessage, "");

        try {
            const response = await fetch("/api/phrases/history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: historyForm.elements.phrase.value,
                    date: historyForm.elements.date.value,
                }),
            });

            if (response.status === 401) {
                window.location.assign("/senha.html");
                return;
            }
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || "Não foi possível adicionar a frase ao histórico.");
            }

            historyForm.reset();
            setMessage(historyMessage, "Frase adicionada ao histórico com a data informada.");
        } catch (error) {
            setMessage(historyMessage, error.message, true);
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
if (page === "home") {
    loadHome();
    setupPhotoCarousel();
}
if (page === "history") loadHistory();
if (page === "login") setupLogin();
if (page === "site-login") setupSiteLogin();
if (page === "edit") setupEditor();
