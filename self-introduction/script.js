/* =========================================================
   DATA ARRAYS
   Edit these arrays to update Skills, Projects, and Interests
   without touching the HTML structure.
   ========================================================= */

const SKILLS = [
  {
    category: "Technical Skills",
    items: ["HTML", "CSS", "JavaScript", "PHP", "Laravel", "Python", "C / C++", "Database Fundamentals"],
  },
  {
    category: "Tools & Platforms",
    items: ["Claude", "Visual Studio Code", "GitHub", "Git", "Figma", "Microsoft Office", "ChatGPT", "Google Workspace"],
  },
  {
    category: "Soft Skills",
    items: ["Problem-Solving", "Communication", "Teamwork", "Adaptability", "Time Management", "Continuous Learning"],
  },
];

const PROJECTS = [
  {
    title: "Classification of Comminuted Bone Fracture Using Hybrid Deep Learning Model",
    description:
      "Developed a hybrid deep learning system to classify comminuted bone fractures from X-ray images.",
    tech: ["Python","TensorFlow","Keras","OpenCV","Scikit-learn", "Pandas","NumPy","Matplotlib"],
    // TODO: replace with your real repository and live links
    github: "#",
    live: "#",
    image: "assets/Detected Simple Fracture.png",
  },
  {
    title: "Cafeteria Management System",
    description: "Designed and developed a cafeteria management system to streamline food ordering, menu management, and order processing. Implemented user authentication, role-based access, and database integration for efficient operations.",
    tech: ["HTML","CSS","JavaScript","PHP","Laravel","MySQL","Bootstrap"],
    // TODO: replace with your real repository and live links
    github: "#",
    live: "#",
    image: "https://placehold.co/400x220/2563EB/F8FAFC?text=Project+2",
  },
  {
    title: "Text Classification using LSTM & CNN",
    description: "Built and compared CNN and LSTM models for text classification. Applied text preprocessing, tokenization, embedding, and performance evaluation.",
    tech: ["Python","TensorFlow","NLTK","Keras","Scikit-learn", "Pandas","NumPy","Matplotlib"],
    // TODO: replace with your real repository and live links
    github: "#",
    live: "#",
    image: "https://placehold.co/400x220/14B8A6/0F172A?text=Project+3",
  },
];

const INTERESTS = [
  { icon: "💻", title: "Programming", desc: "Building small tools and experimenting with new languages." },
  { icon: "🔧", title: "Technology", desc: "Following trends in software and emerging tech." },
  { icon: "📚", title: "Reading", desc: "Exploring books on technology, growth, and ideas." },
  { icon: "✈️", title: "Traveling", desc: "Discovering new places and different perspectives." },
  { icon: "🎵", title: "Music", desc: "Listening to a wide range of genres to unwind." },
  { icon: "📷", title: "Photography", desc: "Capturing everyday moments and small details." },
  { icon: "🏃", title: "Sports", desc: "Staying active and enjoying friendly competition." },
  { icon: "🌱", title: "Learning New Skills", desc: "Always picking up something new to grow." },
];

/* =========================================================
   RENDER FUNCTIONS
   ========================================================= */

function renderSkills() {
  const container = document.getElementById("skillsContainer");
  if (!container) return;

  container.innerHTML = SKILLS.map(
    (group) => `
      <div class="skills__group reveal">
        <h3 class="skills__category-title">${group.category}</h3>
        <div class="skills__tags">
          ${group.items.map((item) => `<span class="skills__tag">${item}</span>`).join("")}
        </div>
      </div>
    `
  ).join("");
}

function renderProjects() {
  const container = document.getElementById("projectsContainer");
  if (!container) return;

  container.innerHTML = PROJECTS.map(
    (project) => `
      <article class="project-card card reveal">
        <img
          src="${project.image}"
          alt="Preview image for ${project.title}"
          class="project-card__image"
          loading="lazy"
        />
        <div class="project-card__body">
          <h3 class="project-card__title">${project.title}</h3>
          <p class="project-card__desc">${project.description}</p>
          <div class="project-card__tech">
            ${project.tech.map((t) => `<span>${t}</span>`).join("")}
          </div>
          <div class="project-card__links">
            <a href="${project.github}" target="_blank" rel="noopener noreferrer" aria-label="View ${project.title} source code on GitHub">GitHub</a>
            <a href="${project.live}" target="_blank" rel="noopener noreferrer" aria-label="View live preview of ${project.title}">Live Preview</a>
          </div>
        </div>
      </article>
    `
  ).join("");
}

function renderInterests() {
  const container = document.getElementById("interestsContainer");
  if (!container) return;

  container.innerHTML = INTERESTS.map(
    (interest) => `
      <div class="interest-card card reveal">
        <div class="interest-card__icon" aria-hidden="true">${interest.icon}</div>
        <h3 class="interest-card__title">${interest.title}</h3>
        <p class="interest-card__desc">${interest.desc}</p>
      </div>
    `
  ).join("");
}

/* =========================================================
   NAVIGATION: mobile menu, sticky shadow, active link
   ========================================================= */

function initMobileMenu() {
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("primaryNav");
  const navLinks = document.querySelectorAll(".nav-link");

  if (!toggle || !nav) return;

  const closeMenu = () => {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation menu");
  };

  const openMenu = () => {
    nav.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close navigation menu");
  };

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.contains("is-open");
    isOpen ? closeMenu() : openMenu();
  });

  // Close the mobile menu automatically after a link is clicked
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });
}

function initStickyNavShadow() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;

  const updateShadow = () => {
    navbar.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  updateShadow();
  window.addEventListener("scroll", updateShadow, { passive: true });
}

function initActiveNavLink() {
  const sections = document.querySelectorAll("main section[id]");
  const navLinks = document.querySelectorAll(".nav-link");

  if (!sections.length || !navLinks.length) return;

  const setActive = (id) => {
    navLinks.forEach((link) => {
      const isMatch = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("is-active", isMatch);
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActive(entry.target.id);
        }
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );

  sections.forEach((section) => observer.observe(section));
}

/* =========================================================
   SCROLL-REVEAL ANIMATIONS
   ========================================================= */

function initScrollReveal() {
  const revealItems = document.querySelectorAll(".reveal");
  if (!revealItems.length) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

/* =========================================================
   BACK TO TOP BUTTON
   ========================================================= */

function initBackToTop() {
  const button = document.getElementById("backToTop");
  if (!button) return;

  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* =========================================================
   CONTACT FORM VALIDATION (no backend — front-end only)
   ========================================================= */

function initContactForm() {
  const form = document.getElementById("contactForm");
  const successMessage = document.getElementById("formSuccess");
  if (!form) return;

  const fields = {
    name: { input: document.getElementById("name"), error: document.getElementById("nameError") },
    email: { input: document.getElementById("email"), error: document.getElementById("emailError") },
    subject: { input: document.getElementById("subject"), error: document.getElementById("subjectError") },
    message: { input: document.getElementById("message"), error: document.getElementById("messageError") },
  };

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateField(key) {
    const { input, error } = fields[key];
    const value = input.value.trim();
    let message = "";

    if (!value) {
      message = "This field is required.";
    } else if (key === "email" && !emailPattern.test(value)) {
      message = "Please enter a valid email address.";
    } else if (key === "message" && value.length < 10) {
      message = "Please write a bit more detail (at least 10 characters).";
    }

    error.textContent = message;
    input.closest(".form__group").classList.toggle("has-error", Boolean(message));
    return !message;
  }

  Object.keys(fields).forEach((key) => {
    fields[key].input.addEventListener("blur", () => validateField(key));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    successMessage.textContent = "";

    const results = Object.keys(fields).map((key) => validateField(key));
    const isValid = results.every(Boolean);

    if (!isValid) {
      successMessage.textContent = "";
      return;
    }

    // No backend is connected. This only simulates a successful submission.
    // To send real messages, connect this form to a service such as
    // Formspree, EmailJS, or your own backend endpoint.
    successMessage.textContent = "Thank you! Your message has been received (demo only — no email was actually sent).";
    form.reset();

    Object.keys(fields).forEach((key) => {
      fields[key].input.closest(".form__group").classList.remove("has-error");
      fields[key].error.textContent = "";
    });
  });
}

/* =========================================================
   FOOTER: current year
   ========================================================= */

function setCurrentYear() {
  const yearEl = document.getElementById("currentYear");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

/* =========================================================
   INIT
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  renderSkills();
  renderProjects();
  renderInterests();

  initMobileMenu();
  initStickyNavShadow();
  initActiveNavLink();
  initScrollReveal();
  initBackToTop();
  initContactForm();
  setCurrentYear();
});
