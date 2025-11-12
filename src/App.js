// Add your imports and other code above

// Fetch games from ESPN API

// Start of filtering logic
const today = new Date();
const nextWeek = new Date(today);
nextWeek.setDate(today.getDate() + 7);

const filteredGames = games.filter(game => {
    const gameDate = new Date(game.date); // Assuming game.date exists
    return gameDate >= today && gameDate <= nextWeek;
});
// End of filtering logic

// Continue with existing game formatting and College Basketball odds logic intact
