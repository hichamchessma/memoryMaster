import React from 'react';

export function useLobbyActions(params: any) {
  const {
    socket,
    tableData,
    setShowQuitConfirm,
    isDealing,
    setScores,
    initializeDeck,
    setCardsFlipped,
    setPlayer1Cards,
    setPlayer2Cards,
    setCardsDealt,
    setIsDealing,
    deckRef,
    player1HandRef,
    player2HandRef,
    setDealAnim,
    setDealingCard,
    dealDelay,
  } = params;

  // Toggle Ready status
  const handleToggleReady = React.useCallback(() => {
    console.log('🎮 handleToggleReady called');
    console.log('  - socket:', socket ? 'connected' : 'null');
    console.log('  - tableData:', tableData);
    console.log('  - tableId:', tableData?.tableId);
    console.log('  - currentUserId:', tableData?.currentUserId);
    
    if (!socket) {
      console.error('❌ Socket not connected');
      return;
    }
    if (!tableData?.tableId) {
      console.error('❌ tableId missing');
      return;
    }
    if (!tableData?.currentUserId) {
      console.error('❌ currentUserId missing');
      return;
    }
    
    console.log('✅ Emitting player:toggle_ready');
    socket.emit('player:toggle_ready', {
      tableId: tableData.tableId,
      userId: tableData.currentUserId
    });
  }, [socket, tableData?.tableId, tableData?.currentUserId]);

  // Quitter la partie
  const handleQuitGame = React.useCallback(() => {
    if (!socket || !tableData?.tableId || !tableData?.currentUserId) return;
    
    console.log('🚪 Quitting game...');
    socket.emit('player:quit_game', {
      tableId: tableData.tableId,
      userId: tableData.currentUserId
    });
    setShowQuitConfirm(false);
  }, [socket, tableData?.tableId, tableData?.currentUserId]);

  // Lance la distribution stylée
  const handleStartNewGame = async (resetScores: boolean = true) => {
    if (isDealing) return; // Éviter les clics multiples
    
    // Réinitialiser les scores si demandé (bouton "Start a new game")
    if (resetScores) {
      setScores({ player1: 0, player2: 0 });
    }

    // Réinitialiser le jeu
    initializeDeck();
    
    // Attendre que le deck soit initialisé
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Crée un nouveau deck mélangé (2 jeux de 52 cartes) + 12 Jokers
    const baseDeck = [...Array(52).keys(), ...Array(52).keys()];
    const jokerCards = [104,105,106,107,108,109,110,111,112,113,114,115];
    const newDeck = [...baseDeck, ...jokerCards]
      .sort(() => Math.random() - 0.5);
    
    // Réinitialiser les cartes des joueurs avec des IDs uniques
    const resetCards = () => 
      Array(4).fill(null).map((_, i) => ({
        id: `card-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        value: -1,
        isFlipped: false
      }));
      
    // Réinitialiser l'état des cartes retournées
    setCardsFlipped({
      player1: { count: 0, indexes: [] },
      player2: { count: 0, indexes: [] }
    });
    
    setPlayer1Cards(resetCards());
    setPlayer2Cards(resetCards());
    setCardsDealt(0);
    
    setIsDealing(true);
    
    // Distribue 4 cartes à chaque joueur
    for (let i = 0; i < 4; i++) {
      // Distribution au joueur 1 (top) - prendre les cartes paires
      const cardValue1 = newDeck[i * 2];
      setPlayer1Cards(prev => {
        const newCards = [...prev];
        newCards[i] = {
          ...newCards[i],
          value: cardValue1,
          isFlipped: false
        };
        return newCards;
      });
      
      // Animation pour le joueur 1
      await new Promise(resolve => {
        setTimeout(() => {
          const deck = deckRef.current;
          const hand = player1HandRef.current;
          if (deck && hand) {
            const deckRect = deck.getBoundingClientRect();
            const handRect = hand.getBoundingClientRect();
            const cardOffset = i * 72;
            const from = {x: deckRect.left + deckRect.width/2, y: deckRect.top + deckRect.height/2};
            const to = {
              x: handRect.left + handRect.width/2 - 108 + cardOffset,
              y: handRect.top + handRect.height/2
            };
            // Ajouter un léger délai pour que l'animation soit plus visible
            setTimeout(() => {
              setDealAnim({
                from: { x: from.x, y: from.y },
                to: { x: to.x, y: to.y },
                toPlayer: 'top',
                index: i,
                cardValue: cardValue1
              });
            }, 20);
          }
          resolve(null);
        }, 10);
      });
      
      await new Promise(resolve => setTimeout(resolve, dealDelay));
      setDealAnim(null);
      
      // Distribution au joueur 2 (bottom) - prendre les cartes impaires
      const cardValue2 = newDeck[i * 2 + 1];
      setPlayer2Cards(prev => {
        const newCards = [...prev];
        newCards[i] = {
          ...newCards[i],
          value: cardValue2,
          isFlipped: false
        };
        return newCards;
      });
      
      // Animation pour le joueur 2
      await new Promise(resolve => {
        setTimeout(() => {
          const deck = deckRef.current;
          const hand = player2HandRef.current;
          if (deck && hand) {
            const deckRect = deck.getBoundingClientRect();
            const handRect = hand.getBoundingClientRect();
            const cardOffset = i * 72;
            const from = {x: deckRect.left + deckRect.width/2, y: deckRect.top + deckRect.height/2};
            const to = {
              x: handRect.left + handRect.width/2 - 108 + cardOffset,
              y: handRect.top + handRect.height/2
            };
            // Ajouter un léger délai pour que l'animation soit plus visible
            setTimeout(() => {
              setDealAnim({
                from: { x: from.x, y: from.y },
                to: { x: to.x, y: to.y },
                toPlayer: 'bottom',
                index: i,
                cardValue: cardValue2
              });
            }, 20);
          }
          resolve(null);
        }, 10);
      });
      
      await new Promise(resolve => setTimeout(resolve, dealDelay));
      setDealAnim(null);
      
      // Mettre à jour le nombre de cartes distribuées
      setCardsDealt(i + 1);
    }
    
    setDealingCard(null);
    setIsDealing(false);
    
    // La transition vers la phase avant tour est gérée par l'effet sur cardsDealt === 4.
    // On évite de forcer ici pour ne pas écraser l'overlay et le gel des actions.
    console.log('Distribution terminée');
    // Réinitialiser l'état des cartes retournées (sécurité)
    setCardsFlipped({
      player1: { count: 0, indexes: [] },
      player2: { count: 0, indexes: [] }
    });
  };

  return { handleToggleReady, handleQuitGame, handleStartNewGame };
}
