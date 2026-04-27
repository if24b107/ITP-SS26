//neu: 
fetch('navbar.html')
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
  const currentPage = window.location.pathname.split('/').pop();
  document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
    if (link.getAttribute('href') === currentPage) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });
}
/*
 alt

// navbar-loader.js
fetch('navbar.html')
  .then(response => response.text())
  .then(data => {
    document.getElementById('navbar-placeholder').innerHTML = data;
    markActiveLink();
    initAuthUI();
  })
  .catch(error => console.error('Fehler beim Laden der Navbar:', error));

function markActiveLink() {
  const currentPage = window.location.pathname.split('/').pop();
  document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
    if (link.getAttribute('href') === currentPage) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });
}

function isUserLoggedIn() {
 return localStorage.getItem('user') !== null;
}

function updateAuthUI() {
 const authContainer = document.getElementById('auth-nav-item');
 if (!authContainer) return;

 if (isUserLoggedIn()) {
   authContainer.innerHTML = `
     <div class="dropdown">
       <button class="btn btn-link dropdown-toggle profile-icon-btn" type="button" id="profileDropdown" data-bs-toggle="dropdown" aria-expanded="false">
         <i class="fas fa-user-circle fa-2x" style="color: var(--rosé-mittel);"></i>
       </button>
       <ul class="dropdown-menu dropdown-menu-end dropdown-menu-rose" aria-labelledby="profileDropdown">
         <li><a class="dropdown-item" href="./personaldashboard.html"><i class="fas fa-tachometer-alt"></i> Mein Dashboard</a></li>
         <li><hr class="dropdown-divider"></li>
         <li><a class="dropdown-item" href="#" id="logout-nav-link"><i class="fas fa-sign-out-alt"></i> Logout</a></li>
       </ul>
     </div>
   `;
   document.getElementById('logout-nav-link')?.addEventListener('click', (e) => {
     e.preventDefault();
     localStorage.removeItem('user');
     updateAuthUI();
     window.location.href = './index.html';
   });
 } else {
   authContainer.innerHTML = `<a id="login-link" class="nav-link login-btn" href="./login.html">Login</a>`;
 }
} 

function initAuthUI() {
  updateAuthUI();
} 
*/