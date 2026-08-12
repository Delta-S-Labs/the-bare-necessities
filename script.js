// The Bare Necessities — light interactions only. No dependencies.

// current year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// nav shadow on scroll
const nav = document.querySelector('.nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// scroll reveal + one-shot cap meter fill
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    // when the cap block reveals, run its meter fill
    if (e.target.classList.contains('cap-viz')) {
      const fill = e.target.querySelector('.cap-fill');
      if (fill) requestAnimationFrame(() => fill.classList.add('filled'));
    }
    io.unobserve(e.target);
  });
}, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// stagger revealed groups a touch for a more editorial cadence
document.querySelectorAll('.ribbon .ribbon-shot').forEach((el, i) => {
  el.style.transitionDelay = `${i * 70}ms`;
});
