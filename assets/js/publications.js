// Abstract toggle and "Copy BibTeX" buttons on the publications page.
(function () {
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback for older browsers / non-secure contexts
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy') ? resolve() : reject();
      } catch (e) {
        reject(e);
      }
      document.body.removeChild(ta);
    });
  }

  document.querySelectorAll('.pub-card').forEach(function (card) {
    var toggle = card.querySelector('.pub-btn--toggle');
    var abstract = card.querySelector('.pub-card__abstract');
    if (toggle && abstract) {
      toggle.addEventListener('click', function () {
        var open = abstract.hidden;
        abstract.hidden = !open;
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    var copyBtn = card.querySelector('.pub-btn--bibtex');
    var bibtex = card.querySelector('.pub-card__bibtex');
    if (copyBtn && bibtex) {
      var label = copyBtn.querySelector('.pub-btn__label');
      var icon = copyBtn.querySelector('i');
      var timer;
      copyBtn.addEventListener('click', function () {
        copyText(bibtex.value).then(function () {
          copyBtn.classList.add('is-copied');
          label.textContent = 'Copied!';
          icon.className = 'fas fa-check';
          clearTimeout(timer);
          timer = setTimeout(function () {
            copyBtn.classList.remove('is-copied');
            label.textContent = 'Copy BibTeX';
            icon.className = 'fas fa-quote-right';
          }, 2000);
        }, function () {
          label.textContent = 'Copy failed';
        });
      });
    }
  });
})();
