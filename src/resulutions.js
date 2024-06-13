function flipCard(card) {
    card.classList.toggle('flipped');
}

document.addEventListener('click', function(event) {
    const cards = document.querySelectorAll('.card');
    let isCardClicked = false;

    cards.forEach(card => {
        if (card.contains(event.target)) {
            isCardClicked = true;
        }
    });

    if (!isCardClicked) {
        cards.forEach(card => {
            card.classList.remove('flipped');
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
        setTimeout(() => {
            card.classList.add('slide-up');
        }, index * 100); 
    });
});