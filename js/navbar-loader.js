// Lädt Navbar aus /partials/navbar.html
fetch('/partials/navbar.html')
  .then(response => response.text())
  .then(data => {
    document.getElementById('navbar-placeholder').innerHTML = data;
    markActiveLink();

    if (window.initAuthNav) {
      window.initAuthNav();
    }
  })
  .catch(error => console.error('Fehler beim Laden der Navbar:', error));

function markActiveLink() {
  const currentPath = window.location.pathname;

  document.querySelectorAll('.navbar-nav .nav-link, .dropdown-menu .dropdown-item').forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href === '#') return;

    const linkPath = new URL(href, window.location.origin).pathname;

    if (linkPath === currentPath) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });
}
