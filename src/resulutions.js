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