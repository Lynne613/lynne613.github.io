document.addEventListener('DOMContentLoaded', function() {
    const items = document.querySelectorAll('.timeline-item');
    let delay = 0;

    items.forEach(item => {
        setTimeout(() => {
            item.classList.add('visible');
        }, delay);
        delay += 500; // 每個項目延遲0.5秒
    });
});