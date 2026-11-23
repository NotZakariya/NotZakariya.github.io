(() => {
  const page = document.querySelector('.photo-competition-page');
  if (!page) return;

  const photos = [...page.querySelectorAll('.prayer-card img')];

  function updateSharedWidth() {
    const ratios = photos
      .filter(photo => photo.naturalWidth > 0 && photo.naturalHeight > 0)
      .map(photo => photo.naturalWidth / photo.naturalHeight);

    if (ratios.length) {
      page.style.setProperty('--photo-min-ratio', Math.min(...ratios));
    }
  }

  photos.forEach(photo => photo.addEventListener('load', updateSharedWidth));
  updateSharedWidth();
})();
