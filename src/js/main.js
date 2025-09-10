  function scrollToSection(id) {
    const section = document.getElementById(id);
    section.scrollIntoView({ behavior: "smooth" });
  }

  const texts = [
    "Ngô Doãn Cường",
    "Thực tập sinh tại H2Q Solution",
    "Front End Developer",
  ];

  const typingElement = document.getElementById("typing-text");
  let textIndex = 0;
  let charIndex = 0;
  let isDeleting = false;

  function typeEffect() {
    let currentText = texts[textIndex];

    if (isDeleting) {
      typingElement.textContent = currentText.substring(0, charIndex--);
    } else {
      typingElement.textContent = currentText.substring(0, charIndex++);
    }

    if (isDeleting && charIndex < 0) {
      isDeleting = false;
      textIndex = (textIndex + 1) % texts.length;
    }

    if (!isDeleting && charIndex === currentText.length + 1) {
      isDeleting = true;
      setTimeout(typeEffect, 1000); // dừng 1s trước khi xoá
      return;
    }

    let speed = isDeleting ? 80 : 120;
    setTimeout(typeEffect, speed);
  }

  // Bắt đầu chạy
  typeEffect();

  function handleClickOpen(modalId) {
    const modal = document.getElementById(modalId);
    const modalContainer = document.getElementById(modalId + "_container");
    if (modal) {
      modal.style.display = "block";
      modalContainer.style.display = "block";
    }
  }
