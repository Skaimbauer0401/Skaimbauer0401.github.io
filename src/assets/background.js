// Dynamischer Hintergrund mit Canvas-Animation
document.addEventListener('DOMContentLoaded', () => {
  // Erstelle Canvas-Element
  const canvas = document.createElement('canvas');
  canvas.id = 'background-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '-2';
  canvas.style.opacity = '0.5';
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let particles = [];
  const particleCount = 50;

  // Passt die Canvas-Größe an das Fenster an
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // Partikel-Objekt
  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 3 + 1;
      this.speedX = Math.random() * 0.5 - 0.25;
      this.speedY = Math.random() * 0.5 - 0.25;
      this.color = this.getRandomColor();
    }

    getRandomColor() {
      const colors = [
        'rgba(155, 48, 255, 0.08)',
        'rgba(232, 62, 140, 0.08)',
        'rgba(40, 180, 120, 0.08)',
        'rgba(80, 80, 80, 0.07)'
      ];
      return colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;

      if (this.x > canvas.width) this.x = 0;
      else if (this.x < 0) this.x = canvas.width;
      if (this.y > canvas.height) this.y = 0;
      else if (this.y < 0) this.y = canvas.height;
    }

    draw() {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Initialisiert die Partikel
  function init() {
    particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
  }

  // Animationsschleife
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
    }

    // Zeichne Verbindungslinien zwischen nahen Partikeln
    drawLines();

    requestAnimationFrame(animate);
  }

  // Zeichnet Verbindungen zwischen nahen Partikeln
  function drawLines() {
    for (let a = 0; a < particles.length; a++) {
      for (let b = a; b < particles.length; b++) {
        const dx = particles[a].x - particles[b].x;
        const dy = particles[a].y - particles[b].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 100) {
          const opacity = 1 - distance / 100;
          ctx.strokeStyle = `rgba(155, 48, 255, ${opacity * 0.08})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(particles[a].x, particles[a].y);
          ctx.lineTo(particles[b].x, particles[b].y);
          ctx.stroke();
        }
      }
    }
  }

  // Event Listener für Fenstergrößenänderungen
  window.addEventListener('resize', resizeCanvas);

  // Initialisierung
  resizeCanvas();
  init();
  animate();
});
