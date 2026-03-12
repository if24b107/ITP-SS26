// navbar-loader.js
fetch('navbar.html')
  .then(response => response.text())
  .then(data => {
    // Navbar einfügen
    document.getElementById('navbar-placeholder').innerHTML = data;

    // Aktuellen Link als active markieren
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    navLinks.forEach(link => {
      if (link.getAttribute('href') === currentPage) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    });
  })
  .catch(error => console.error('Fehler beim Laden der Navbar:', error));