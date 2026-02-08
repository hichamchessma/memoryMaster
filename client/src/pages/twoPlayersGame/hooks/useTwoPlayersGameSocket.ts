import React from 'react';

type GamePhase = 'preparation' | 'before_round' | 'player1_turn' | 'player2_turn';

export function useTwoPlayersGameSocket(params: any) {
  const {
    socket,
    tableData,
    navigate,
    hasJoinedRoom,
    amIPlayer1,
    tablePlayers,
    bombomDeclaredBy,
    currentPlayer,
    bombomTurnPassedToOpponent,
    myPlayerInfo,
    opponentInfo,
    discardPile,
    quickDiscardActive,
    showShowTimePrompt,
    deckRef,
    player1HandRef,
    player2HandRef,
    discardRef,
    beforeRoundTimerRef,
    bombomTimerRef,
    drawnCardRef,
    isInPenaltyRef,
    isPlayerTurnRef,
    jackPowerUsedRef,
    myPlayerInfoRef,
    timerRef,
    setTablePlayers,
    setMyPlayerInfo,
    setOpponentInfo,
    setMyReadyStatus,
    setOpponentReadyStatus,
    setGameStarted,
    setAmIPlayer1,
    setPlayer1Cards,
    setPlayer2Cards,
    setShowPrepOverlay,
    setIsMemorizationPhase,
    setMemorizedCardsCount,
    setMemorizedCardIndexes,
    setIsPlayerTurn,
    setGamePhase,
    setCurrentPlayer,
    setBombomTurnPassedToOpponent,
    setShowShowTimePrompt,
    setDrawnCard,
    setShowCardActions,
    setSelectingCardToReplace,
    setReplaceInAnim,
    setReplaceOutAnim,
    setReplaceOutImage,
    setReplaceInImage,
    setDiscardPile,
    setQuickDiscardFlash,
    setIsInPenalty,
    setQuickDiscardActive,
    setPenaltyPlayer,
    setFaultyCardIndex,
    setPenaltyCue,
    setShowPenaltyDim,
    setTimerPhase,
    setTimeLeft,
    setMemoTimeLeft,
    setGameTimeLeft,
    setChoiceTimeLeft,
    setShowMemorizationEndOverlay,
    setIsKingPowerActive,
    setKingPowerActivated,
    setKingSelections,
    setPowerCue,
    setIsQueenPowerActive,
    setQueenCue,
    setQueenCardSelected,
    setIsJackPowerActive,
    setJackCue,
    setJackCardSelected,
    setAnyPowerActive,
    setBombomDeclaredBy,
    setBombomCancelUsed,
    setLastBombomPlayer,
    setShowScoreboard,
    setIsPowerfulMode,
    getCardImage,
    getRankLabel,
    handleShowTime,
    isInPenalty,
    drawnCard,
  } = params;

  React.useEffect(() => {
    isInPenaltyRef.current = isInPenalty;
  }, [isInPenalty]);
  React.useEffect(() => {
    drawnCardRef.current = drawnCard;
  }, [drawnCard]);
  React.useEffect(() => {
    myPlayerInfoRef.current = myPlayerInfo;
  }, [myPlayerInfo]);
  React.useEffect(() => {
    if (!socket || !tableData?.tableId) return;
    if (hasJoinedRoom.current) return; // Ne pas rejoindre si dÃ©jÃ  fait

    console.log('ðŸ”Œ Joining table room:', tableData.tableId);
    console.log('ðŸ”Œ Current user ID:', tableData.currentUserId);
    console.log('ðŸ”Œ Socket connected:', socket.connected);
    console.log('ðŸ”Œ Socket ID:', socket.id);
    
    socket.emit('joinTableRoom', { 
      tableId: tableData.tableId,
      userId: tableData.currentUserId 
    });
    hasJoinedRoom.current = true;

    // Ã‰couter quand un joueur rejoint la table
    const handlePlayerJoined = (data: any) => {
      console.log('ðŸ‘¤ Player joined event received!', data);
      console.log('ðŸ‘¤ Players in table:', data.table?.players);
      
      if (data.table && data.table.players) {
        setTablePlayers(data.table.players);
        
        // Mettre Ã  jour les infos des joueurs
        const currentPlayer = data.table.players.find((p: any) => p._id === tableData.currentUserId);
        const otherPlayer = data.table.players.find((p: any) => p._id !== tableData.currentUserId);
        
        console.log('ðŸ‘¤ Current player found:', currentPlayer);
        console.log('ðŸ‘¤ Other player found:', otherPlayer);
        
        if (currentPlayer) {
          setMyPlayerInfo({
            name: `${currentPlayer.firstName} ${currentPlayer.lastName}`,
            isReal: true,
            userId: currentPlayer._id
          });
        }
        
        if (otherPlayer) {
          setOpponentInfo({
            name: `${otherPlayer.firstName} ${otherPlayer.lastName}`,
            isReal: true,
            userId: otherPlayer._id
          });
          console.log('âœ… Opponent info updated:', `${otherPlayer.firstName} ${otherPlayer.lastName}`);
        } else {
          console.log('âš ï¸ No opponent found yet');
        }
      }
    };

    socket.on('playerJoined', handlePlayerJoined);
    
    // Ã‰couter aussi table_updated (Ã©vÃ©nement alternatif)
    socket.on('table_updated', handlePlayerJoined);

    // Ã‰couter les changements de statut Ready
    const handleReadyChanged = (data: any) => {
      console.log('ðŸŽ® Ready status changed:', data);
      
      if (data.userId === tableData.currentUserId) {
        setMyReadyStatus(data.isReady);
      } else {
        setOpponentReadyStatus(data.isReady);
      }
    };

    // Ã‰couter le dÃ©marrage automatique de la partie
    const handleAutoStart = (data: any) => {
      console.log('ðŸš€ Game auto-starting:', data);
      setGameStarted(true);
    };

    // Ã‰couter la distribution des cartes
    const handleCardsDealt = (data: any) => {
      console.log('ðŸƒ Cards dealt received:', data);
      
      if (!data.myCards) {
        console.error('âŒ No myCards in data');
        return;
      }
      
      if (!data.opponentCards) {
        console.error('âŒ No opponentCards in data');
        return;
      }
      
      console.log('ðŸƒ Cards dealt received:', data);
      console.log('  myCards:', data.myCards);
      console.log('  opponentCards:', data.opponentCards);
      console.log('  amIPlayer1 (from server):', data.amIPlayer1);
      console.log('  amIPlayer1 (current state):', amIPlayer1);
      
      // Sauvegarder si je suis player1 ou player2 (UNE SEULE FOIS)
      if (amIPlayer1 === null) {
        console.log('âœ… Setting amIPlayer1 for the FIRST time:', data.amIPlayer1);
        setAmIPlayer1(data.amIPlayer1);
      } else {
        console.log('âš ï¸ amIPlayer1 already set, ignoring new value');
      }
      
      // CrÃ©er les cartes avec isFlipped=false (face cachÃ©e)
      const myCards = data.myCards.map((card: any) => ({
        value: card.value,
        isFlipped: false,
        id: Math.random()
      }));
      
      const opponentCards = data.opponentCards.map((card: any) => ({
        value: -1, // Face cachÃ©e pour l'adversaire
        isFlipped: false,
        id: Math.random()
      }));
      
      // Mettre Ã  jour les cartes des joueurs selon la position
      console.log('ðŸƒ Setting initial cards');
      console.log('  myCards[0].isFlipped:', myCards[0]?.isFlipped);
      console.log('  opponentCards[0].isFlipped:', opponentCards[0]?.isFlipped);
      
      if (data.amIPlayer1) {
        // Je suis player1 (en haut), l'adversaire est player2 (en bas)
        setPlayer1Cards(myCards);
        setPlayer2Cards(opponentCards);
      } else {
        // Je suis player2 (en bas), l'adversaire est player1 (en haut)
        setPlayer2Cards(myCards);
        setPlayer1Cards(opponentCards);
      }
      
      // Animation de distribution des cartes (comme dans TrainingPage)
      const DEAL_DELAY = 400;
      const allCards = [
        ...data.myCards.map((card: any, i: number) => ({ card, player: 'bottom', index: i })),
        ...data.opponentCards.map((card: any, i: number) => ({ card, player: 'top', index: i }))
      ];
      
      // Distribuer les cartes une par une avec animation
      allCards.forEach((item, idx) => {
        setTimeout(() => {
          if (item.player === 'bottom') {
            setPlayer2Cards(prev => {
              const newCards = [...prev];
              newCards[item.index] = {
                ...newCards[item.index],
                value: item.card.value,
                isFlipped: false // Face cachÃ©e pendant la distribution
              };
              return newCards;
            });
          } else {
            setPlayer1Cards(prev => {
              const newCards = [...prev];
              newCards[item.index] = {
                ...newCards[item.index],
                value: item.card.value,
                isFlipped: false // Face cachÃ©e pendant la distribution
              };
              return newCards;
            });
          }
          
          // AprÃ¨s la derniÃ¨re carte, afficher l'overlay de prÃ©paration
          if (idx === allCards.length - 1) {
            setTimeout(() => {
              // Afficher "PrÃ©parez-vous !" pendant 2 secondes
              setShowPrepOverlay(true);
              
              setTimeout(() => {
                // Cacher l'overlay aprÃ¨s 2 secondes
                setShowPrepOverlay(false);
                
                // Activer la phase de mÃ©morisation (le serveur gÃ¨re le timer)
                setIsMemorizationPhase(true);
                setMemorizedCardsCount(0);
                setMemorizedCardIndexes([]);
                
                console.log('ðŸ§  Memorization phase started - Click on 2 of YOUR cards to memorize');
              }, 2000); // Cacher l'overlay aprÃ¨s 2 secondes
            }, 500); // DÃ©lai aprÃ¨s la derniÃ¨re carte
          }
        }, idx * DEAL_DELAY); // DÃ©lai entre chaque carte
      });
    };

    // Ã‰couter quand un joueur quitte
    const handlePlayerQuit = (data: any) => {
      console.log('ðŸšª Player quit:', data);
      alert(data.message);
      // Rediriger vers le dashboard
      navigate('/dashboard');
    };

    // Ã‰couter les changements de tour
    const handleTurnChanged = (data: any) => {
      console.log('ðŸ”„ Turn changed:', data);
      console.log('ðŸ¬ Ã‰tat Bombom lors du changement de tour:', { bombomDeclaredBy, currentPlayer });
      const { currentPlayerId, currentPlayerName } = data;
      
      // Utiliser tableData.currentUserId pour comparer
      const myUserId = tableData?.currentUserId;
      console.log(`  ðŸ†” My userId: ${myUserId}, Current turn userId: ${currentPlayerId}`);
      console.log(`  ðŸŽ® Am I player1? ${amIPlayer1}`);
      
      // DÃ©terminer si c'est notre tour
      const isMyTurn = currentPlayerId === myUserId;
      console.log(`  âœ… isMyTurn = ${isMyTurn} (${currentPlayerId} === ${myUserId})`);
      setIsPlayerTurn(isMyTurn);
      
      // NOUVELLE LOGIQUE: Utiliser les IDs des joueurs pour dÃ©terminer qui est player1/player2
      // IMPORTANT: Utiliser tablePlayers (mis Ã  jour par le serveur) et non tableData.players (statique)
      const players = tablePlayers.length > 0 ? tablePlayers : (tableData?.players || []);
      const player1Id = players[0]?._id;
      const player2Id = players[1]?._id;
      
      console.log(`ðŸ“Š DEBUG handleTurnChanged:`);
      console.log(`  â†’ currentPlayerId: ${currentPlayerId}`);
      console.log(`  â†’ player1Id: ${player1Id}`);
      console.log(`  â†’ player2Id: ${player2Id}`);
      console.log(`  â†’ players:`, players);
      console.log(`  â†’ Comparison: currentPlayerId === player1Id? ${currentPlayerId === player1Id}`);
      console.log(`  â†’ Comparison: currentPlayerId === player2Id? ${currentPlayerId === player2Id}`);
      
      // DÃ©terminer quelle phase selon qui joue
      let newPhase: GamePhase;
      if (currentPlayerId === player1Id) {
        newPhase = 'player1_turn';
        setGamePhase('player1_turn');
        setCurrentPlayer('player1');
        console.log(`âœ… Player 1's turn (${currentPlayerName}) - gamePhase: player1_turn`);
      } else if (currentPlayerId === player2Id) {
        newPhase = 'player2_turn';
        setGamePhase('player2_turn');
        setCurrentPlayer('player2');
        console.log(`âœ… Player 2's turn (${currentPlayerName}) - gamePhase: player2_turn`);
      } else {
        console.error('âš ï¸ Unknown player ID:', currentPlayerId);
        console.error('  â†’ This should NEVER happen!');
        return;
      }
      
      // LOGIQUE BOMBOM: Suivre le cadre vert (joueur actif)
      if (bombomDeclaredBy) {
        console.log('ðŸ¬ BOMBOM TRACKING:');
        console.log(`  â†’ Bombom dÃ©clarÃ© par: ${bombomDeclaredBy}`);
        console.log(`  â†’ Joueur actuel: ${currentPlayer}`);
        console.log(`  â†’ Tour passÃ© Ã  l'adversaire: ${bombomTurnPassedToOpponent}`);
        
        if (bombomDeclaredBy !== currentPlayer && !bombomTurnPassedToOpponent) {
          // Le tour est passÃ© Ã  l'adversaire pour la premiÃ¨re fois
          console.log('ðŸ¬ Le tour est passÃ© Ã  l\'adversaire aprÃ¨s dÃ©claration Bombom');
          setBombomTurnPassedToOpponent(true);
        } 
        else if (bombomDeclaredBy === currentPlayer && bombomTurnPassedToOpponent) {
          // Le tour est revenu au joueur qui a dÃ©clarÃ© Bombom
          console.log('ðŸ¬ LE TOUR EST REVENU AU JOUEUR QUI A DÃ‰CLARÃ‰ BOMBOM!');
          console.log('ðŸ¬ AFFICHAGE DU PROMPT SHOWTIME!');
          
          // Afficher le prompt ShowTime
          setShowShowTimePrompt(true);
          
          // RÃ©initialiser le suivi
          setBombomTurnPassedToOpponent(false);
        }
      }
      
      if (isMyTurn) {
        console.log(`âœ… It's MY turn! (${currentPlayerName})`);
      } else {
        console.log(`â³ Waiting for opponent... (${currentPlayerName})`);
      }
      
      // Nettoyer l'ancien timer s'il existe (le serveur gÃ¨re maintenant les timers)
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Le timer est maintenant gÃ©rÃ© par le serveur via game:timer_update
      // On ne dÃ©marre plus de timer local ici
      
      // RÃ©initialiser l'Ã©tat de la carte piochÃ©e pour permettre de piocher Ã  nouveau
      // quand le tour revient au joueur aprÃ¨s que l'adversaire n'a rien fait
      setDrawnCard(null);
      setShowCardActions(false);
      setSelectingCardToReplace(false);
      
      console.log(`âœ… Turn changed handled - gamePhase: ${newPhase}, isMyTurn: ${isMyTurn}`);
    };

    // Ã‰couter quand un joueur pioche une carte
    const handleCardDrawn = (data: any) => {
      console.log('ðŸŽ´ Card drawn:', data);
      const { playerId, card } = data;
      
      // Si c'est nous qui avons piochÃ©, on voit la carte
      if (playerId === myPlayerInfo?.userId) {
        console.log('ðŸ‘ï¸ I drew:', card);
        setDrawnCard(card);
        setSelectingCardToReplace(true);
      } else {
        // Sinon, on voit juste qu'il a piochÃ© (carte face cachÃ©e)
        console.log('ðŸ‘€ Opponent drew a card (face down)');
        // TODO: Afficher une animation de pioche
      }
    };
    
    // Ã‰couter quand l'adversaire pioche (on voit juste l'animation)
    const handleOpponentDrewCard = (data: any) => {
      console.log('ðŸ‘€ Opponent drew a card (face down):', data);
      
      // Animation de carte qui vole du deck vers la main de l'adversaire (face cachÃ©e)
      const deck = deckRef.current;
      // L'adversaire est toujours en haut (player1 visuel)
      const opponentHand = player1HandRef.current;
      
      if (deck && opponentHand) {
        const deckRect = deck.getBoundingClientRect();
        const handRect = opponentHand.getBoundingClientRect();
        
        // Animation: deck â†’ main adversaire
        setReplaceInAnim({
          from: { x: deckRect.left + deckRect.width/2, y: deckRect.top + deckRect.height/2 },
          to: { x: handRect.left + handRect.width/2, y: handRect.top + handRect.height/2 },
          toPlayer: amIPlayer1 ? 'bottom' : 'top',
          index: 0,
          cardValue: -1 // Face cachÃ©e
        });
        
        // Nettoyer aprÃ¨s l'animation
        setTimeout(() => {
          setReplaceInAnim(null);
        }, 1000);
      }
      
      console.log(`âœ… Opponent drew a card - Animation shown`);
    };
    
    // Fonction utilitaire pour mettre Ã  jour un tableau de cartes de maniÃ¨re cohÃ©rente
    const updateCardArray = (prev: any[], cardIndex: number, isQuickDiscard: boolean): any[] => {
      if (cardIndex === -1) return prev; // DÃ©fausse directe de la carte piochÃ©e
      
      const newCards = [...prev];
      
      // S'assurer que le tableau a la bonne taille
      while (newCards.length <= cardIndex) {
        newCards.push({
          id: `card-filler-${Date.now()}-${Math.random()}`,
          value: -1,
          isFlipped: false
        });
      }
      
      // Pour toutes les dÃ©fausses, mettre la valeur Ã  -1 au lieu de supprimer
      newCards[cardIndex] = {
        id: `discarded-${Date.now()}-${Math.random()}`,
        value: -1,
        isFlipped: false
      };
      
      return newCards;
    };

    // Ã‰couter quand une carte est dÃ©faussÃ©e
    const handleCardDiscarded = (data: any) => {
      console.log('ðŸšŸï¸ Card discarded event received:', data);
      const { playerId, card, cardIndex, autoDiscard, quickDiscard, totalCards } = data;
      
      console.log(`  â†’ Updating discard pile with card: ${card}`);
      console.log(`  â†’ Current discardPile before update:`, discardPile);
      console.log(`  â†’ Quick discard: ${quickDiscard}, Auto discard: ${autoDiscard}`);
      if (totalCards) console.log(`  â†’ Total cards after discard: ${totalCards}`);
      
      // Animation de dÃ©fausse
      const discard = discardRef.current;
      let sourceHand: HTMLDivElement | null = null;
      
      // DÃ©terminer d'oÃ¹ vient la carte
      // Moi = toujours en bas (player2 visuel), Adversaire = toujours en haut (player1 visuel)
      if (playerId === tableData?.currentUserId) {
        // C'est moi qui dÃ©fausse (en bas)
        sourceHand = player2HandRef.current;
      } else {
        // C'est l'adversaire qui dÃ©fausse (en haut)
        sourceHand = player1HandRef.current;
      }
      
      if (discard && sourceHand) {
        const discardRect = discard.getBoundingClientRect();
        const handRect = sourceHand.getBoundingClientRect();
        
        // Animation: main â†’ dÃ©fausse
        setReplaceOutAnim({
          from: { x: handRect.left + handRect.width/2, y: handRect.top + handRect.height/2 },
          to: { x: discardRect.left + discardRect.width/2, y: discardRect.top + discardRect.height/2 },
          toPlayer: 'top',
          index: 0,
          cardValue: card
        });
        setReplaceOutImage(getCardImage(card));
        
        // Mettre Ã  jour la dÃ©fausse aprÃ¨s l'animation
        setTimeout(() => {
          setDiscardPile(card);
          setReplaceOutAnim(null);
          setReplaceOutImage(null);
          console.log(`  âœ… setDiscardPile(${card}) called after animation`);
        }, 1000);
      } else {
        // Pas d'animation, mise Ã  jour directe
        setDiscardPile(card);
        console.log(`  âœ… setDiscardPile(${card}) called (no animation)`);
      }
      
      // Afficher un message si c'est une dÃ©fausse automatique
      if (autoDiscard) {
        console.log('â° Auto-discard due to timeout');
      }
      
      // Afficher le flash de dÃ©fausse rapide
      if (quickDiscard && quickDiscardActive) {
        const rank = getRankLabel(card);
        const playerName = playerId === myPlayerInfo?.userId 
          ? myPlayerInfo?.name 
          : opponentInfo?.name;
        setQuickDiscardFlash(`${playerName} a jetÃ© ${rank}`);
        setTimeout(() => setQuickDiscardFlash(null), 1000);
      }
      
      // RÃ©initialiser les Ã©tats de carte piochÃ©e pour TOUS les joueurs
      setDrawnCard(null);
      setShowCardActions(false);
      setSelectingCardToReplace(false);
      
      // Mettre Ã  jour les cartes en utilisant notre fonction utilitaire
      if (playerId !== myPlayerInfo?.userId) {
        // L'adversaire a dÃ©faussÃ©
        if (amIPlayer1) {
          // Je suis player1 (en haut), l'adversaire est player2 et ses cartes sont en BAS (player2Cards)
          setPlayer2Cards(prev => {
            // CrÃ©er un nouveau tableau avec le bon nombre de cartes
            let updatedCards = [...prev];
            
            // Si c'est une dÃ©fausse rapide, on supprime la carte Ã  l'index spÃ©cifiÃ©
            if (quickDiscard && cardIndex < updatedCards.length) {
              console.log(`â— Removing opponent's card at index ${cardIndex} for quick discard`);
              updatedCards = [...updatedCards.slice(0, cardIndex), ...updatedCards.slice(cardIndex + 1)];
            }
            
            // S'assurer que le tableau a exactement le bon nombre de cartes
            if (totalCards && updatedCards.length !== totalCards) {
              console.log(`â— Fixing card count: current=${updatedCards.length}, should be=${totalCards}`);
              
              // Si on a trop de cartes, on les supprime
              if (updatedCards.length > totalCards) {
                updatedCards = updatedCards.slice(0, totalCards);
              }
              
              // Si on n'a pas assez de cartes, on en ajoute
              while (updatedCards.length < totalCards) {
                updatedCards.push({
                  id: `opponent-card-filler-${Date.now()}-${Math.random()}`,
                  value: -1,
                  isFlipped: false
                });
              }
            }
            
            console.log(`âœ… Updated opponent's cards (player2, en bas). Now has ${updatedCards.length} cards`);
            return updatedCards;
          });
        } else {
          // Je suis player2 (en bas), l'adversaire est player1 et ses cartes sont en HAUT (player1Cards)
          setPlayer1Cards(prev => {
            // CrÃ©er un nouveau tableau avec le bon nombre de cartes
            let updatedCards = [...prev];
            
            // Si c'est une dÃ©fausse rapide, on supprime la carte Ã  l'index spÃ©cifiÃ©
            if (quickDiscard && cardIndex < updatedCards.length) {
              console.log(`â— Removing opponent's card at index ${cardIndex} for quick discard`);
              updatedCards = [...updatedCards.slice(0, cardIndex), ...updatedCards.slice(cardIndex + 1)];
            }
            
            // S'assurer que le tableau a exactement le bon nombre de cartes
            if (totalCards && updatedCards.length !== totalCards) {
              console.log(`â— Fixing card count: current=${updatedCards.length}, should be=${totalCards}`);
              
              // Si on a trop de cartes, on les supprime
              if (updatedCards.length > totalCards) {
                updatedCards = updatedCards.slice(0, totalCards);
              }
              
              // Si on n'a pas assez de cartes, on en ajoute
              while (updatedCards.length < totalCards) {
                updatedCards.push({
                  id: `opponent-card-filler-${Date.now()}-${Math.random()}`,
                  value: -1,
                  isFlipped: false
                });
              }
            }
            
            console.log(`âœ… Updated opponent's cards (player1, en haut). Now has ${updatedCards.length} cards`);
            return updatedCards;
          });
        }
      } else {
        // C'est moi qui ai dÃ©faussÃ©
        if (amIPlayer1) {
          // Je suis player1 (en haut)
          setPlayer1Cards(prev => {
            // CrÃ©er un nouveau tableau avec le bon nombre de cartes
            let updatedCards = [...prev];
            
            // Si c'est une dÃ©fausse rapide, supprimer la carte Ã  l'index spÃ©cifiÃ©
            if (quickDiscard && cardIndex < updatedCards.length) {
              console.log(`â— Removing card at index ${cardIndex} for quick discard`);
              updatedCards = [...updatedCards.slice(0, cardIndex), ...updatedCards.slice(cardIndex + 1)];
            }
            
            // S'assurer que le tableau a exactement le bon nombre de cartes
            if (totalCards && updatedCards.length !== totalCards) {
              console.log(`â— Fixing card count: current=${updatedCards.length}, should be=${totalCards}`);
              
              // Si on a trop de cartes, on les supprime
              if (updatedCards.length > totalCards) {
                updatedCards = updatedCards.slice(0, totalCards);
              }
              
              // Si on n'a pas assez de cartes, on en ajoute
              while (updatedCards.length < totalCards) {
                updatedCards.push({
                  id: `my-card-filler-${Date.now()}-${Math.random()}`,
                  value: -1,
                  isFlipped: false
                });
              }
            }
            
            console.log(`âœ… Updated my cards (player1, en haut). Now has ${updatedCards.length} cards`);
            return updatedCards;
          });
        } else {
          // Je suis player2 (en bas)
          setPlayer2Cards(prev => {
            // CrÃ©er un nouveau tableau avec le bon nombre de cartes
            let updatedCards = [...prev];
            
            // Si c'est une dÃ©fausse rapide, supprimer la carte Ã  l'index spÃ©cifiÃ©
            if (quickDiscard && cardIndex < updatedCards.length) {
              console.log(`â— Removing card at index ${cardIndex} for quick discard`);
              updatedCards = [...updatedCards.slice(0, cardIndex), ...updatedCards.slice(cardIndex + 1)];
            }
            
            // S'assurer que le tableau a exactement le bon nombre de cartes
            if (totalCards && updatedCards.length !== totalCards) {
              console.log(`â— Fixing card count: current=${updatedCards.length}, should be=${totalCards}`);
              
              // Si on a trop de cartes, on les supprime
              if (updatedCards.length > totalCards) {
                updatedCards = updatedCards.slice(0, totalCards);
              }
              
              // Si on n'a pas assez de cartes, on en ajoute
              while (updatedCards.length < totalCards) {
                updatedCards.push({
                  id: `my-card-filler-${Date.now()}-${Math.random()}`,
                  value: -1,
                  isFlipped: false
                });
              }
            }
            
            console.log(`âœ… Updated my cards (player2, en bas). Now has ${updatedCards.length} cards`);
            return updatedCards;
          });
        }
      }
      
      console.log(`âœ… Discard pile updated - Card: ${card}`);
    };
    
    // Ã‰couter quand une carte est remplacÃ©e
    const handleCardReplaced = (data: any) => {
      console.log('ðŸ”„ Card replaced:', data);
      const { playerId, cardIndex, discardedCard, newCard, newCardValue, totalCards } = data;
      
      // Mettre Ã  jour la dÃ©fausse (discardedCard peut Ãªtre un objet ou une valeur)
      const discardValue = typeof discardedCard === 'object' && discardedCard !== null
        ? discardedCard.value
        : discardedCard;
      setDiscardPile(discardValue);
      console.log(`âœ… Updated discard pile with card value: ${discardValue}`);
      console.log(`âœ… New card value: ${newCardValue}`);
      
      // Si c'est l'adversaire qui a remplacÃ© une carte
      if (playerId !== tableData?.currentUserId) {
        // DÃ©terminer quelle liste de cartes mettre Ã  jour en fonction de amIPlayer1
        if (amIPlayer1) {
          // Je suis player1 (en haut), l'adversaire est player2 (en bas)
          setPlayer2Cards(prev => {
            // CrÃ©er un nouveau tableau avec le bon nombre de cartes
            let updatedCards = [...prev];
            
            // S'assurer que le tableau a exactement le bon nombre de cartes
            if (totalCards && updatedCards.length !== totalCards) {
              console.log(`â— Fixing card count: current=${updatedCards.length}, should be=${totalCards}`);
              
              // Si on a trop de cartes, on les supprime
              if (updatedCards.length > totalCards) {
                updatedCards = updatedCards.slice(0, totalCards);
              }
              
              // Si on n'a pas assez de cartes, on en ajoute
              while (updatedCards.length < totalCards) {
                updatedCards.push({
                  id: `opponent-card-filler-${Date.now()}-${Math.random()}`,
                  value: -1,
                  isFlipped: false
                });
              }
            }
            
            // Mettre Ã  jour la carte Ã  l'index spÃ©cifiÃ© avec la nouvelle valeur
            if (cardIndex < updatedCards.length && newCardValue !== undefined) {
              updatedCards[cardIndex] = {
                id: `opponent-card-${Date.now()}-${Math.random()}`,
                value: newCardValue, // Utiliser la valeur de la nouvelle carte
                isFlipped: false
              };
              console.log(`âœ… Updated opponent's card at index ${cardIndex} with value ${newCardValue}`);
            }
            
            console.log(`âœ… Updated opponent's cards (player2, en bas). Now has ${updatedCards.length} cards.`);
            return updatedCards;
          });
        } else {
          // Je suis player2 (en bas), l'adversaire est player1 (en haut)
          setPlayer1Cards(prev => {
            // CrÃ©er un nouveau tableau avec le bon nombre de cartes
            let updatedCards = [...prev];
            
            // S'assurer que le tableau a exactement le bon nombre de cartes
            if (totalCards && updatedCards.length !== totalCards) {
              console.log(`â— Fixing card count: current=${updatedCards.length}, should be=${totalCards}`);
              
              // Si on a trop de cartes, on les supprime
              if (updatedCards.length > totalCards) {
                updatedCards = updatedCards.slice(0, totalCards);
              }
              
              // Si on n'a pas assez de cartes, on en ajoute
              while (updatedCards.length < totalCards) {
                updatedCards.push({
                  id: `opponent-card-filler-${Date.now()}-${Math.random()}`,
                  value: -1,
                  isFlipped: false
                });
              }
            }
            
            // Mettre Ã  jour la carte Ã  l'index spÃ©cifiÃ© avec la nouvelle valeur
            if (cardIndex < updatedCards.length && newCardValue !== undefined) {
              updatedCards[cardIndex] = {
                id: `opponent-card-${Date.now()}-${Math.random()}`,
                value: newCardValue, // Utiliser la valeur de la nouvelle carte
                isFlipped: false
              };
              console.log(`âœ… Updated opponent's card at index ${cardIndex} with value ${newCardValue}`);
            }
            
            console.log(`âœ… Updated opponent's cards (player1, en haut). Now has ${updatedCards.length} cards.`);
            return updatedCards;
          });
        }
      } else {
        // C'est moi qui ai remplacÃ© une carte (ne devrait pas arriver car dÃ©jÃ  gÃ©rÃ© localement)
        console.log(`â„¹ï¸ Received my own card replacement event from server (unusual)`);
      }
    };
    
    // Ã‰couter la rÃ©ception des cartes de pÃ©nalitÃ© (seulement pour le joueur pÃ©nalisÃ©)
    const handlePenaltyCardsReceived = (data: any) => {
      console.log('ðŸ“¥ Penalty cards received:', data);
      const { cards, totalCards } = data;
      console.log(`  â†’ Total cards after penalty: ${totalCards}`);
      
      // DÃ©terminer quelle liste de cartes mettre Ã  jour en fonction de amIPlayer1
      if (amIPlayer1) {
        // Je suis player1, mes cartes sont dans player1Cards (en haut)
        setPlayer1Cards(prev => {
          // CrÃ©er un nouveau tableau avec le bon nombre de cartes
          let newCards = [...prev];
          
          // S'assurer que le tableau a exactement le bon nombre de cartes
          if (totalCards) {
            console.log(`  â†’ â— Checking card count: current=${newCards.length}, should be=${totalCards} after adding ${cards.length} cards`);
            
            // Si on a trop de cartes, on les supprime
            if (newCards.length > totalCards - cards.length) {
              console.log(`  â†’ â— Removing ${newCards.length - (totalCards - cards.length)} excess cards`);
              newCards = newCards.slice(0, totalCards - cards.length);
            }
          }
          
          // Ajouter les nouvelles cartes de pÃ©nalitÃ©
          cards.forEach((cardValue: number) => {
            newCards.push({
              id: `penalty-${Date.now()}-${Math.random()}`,
              value: cardValue,
              isFlipped: false
            });
          });
          
          console.log(`  â†’ Updated my cards (player1). Now has ${newCards.length} cards`);
          return newCards;
        });
      } else {
        // Je suis player2, mes cartes sont dans player2Cards (en bas)
        setPlayer2Cards(prev => {
          // CrÃ©er un nouveau tableau avec le bon nombre de cartes
          let newCards = [...prev];
          
          // S'assurer que le tableau a exactement le bon nombre de cartes
          if (totalCards) {
            console.log(`  â†’ â— Checking card count: current=${newCards.length}, should be=${totalCards} after adding ${cards.length} cards`);
            
            // Si on a trop de cartes, on les supprime
            if (newCards.length > totalCards - cards.length) {
              console.log(`  â†’ â— Removing ${newCards.length - (totalCards - cards.length)} excess cards`);
              newCards = newCards.slice(0, totalCards - cards.length);
            }
          }
          
          // Ajouter les nouvelles cartes de pÃ©nalitÃ©
          cards.forEach((cardValue: number) => {
            newCards.push({
              id: `penalty-${Date.now()}-${Math.random()}`,
              value: cardValue,
              isFlipped: false
            });
          });
          
          console.log(`  â†’ Updated my cards (player2). Now has ${newCards.length} cards`);
          return newCards;
        });
      }
      
      console.log(`âœ… Added ${cards.length} penalty cards to my hand`);
    };
    
    // Ã‰couter la pÃ©nalitÃ© de dÃ©fausse rapide (pour TOUS les joueurs)
    const handleQuickDiscardPenaltyApplied = async (data: any) => {
      console.log('ðŸ“¥ Quick discard penalty applied:', data);
      const { playerId, playerName, cardIndex, totalCards, penaltyCards } = data;
      console.log(`  â†’ Penalty player: ${playerId} (${playerName})`);
      console.log(`  â†’ Card index: ${cardIndex}`);
      console.log(`  â†’ Total cards after penalty: ${totalCards}`);
      console.log(`  â†’ Penalty cards: ${penaltyCards ? penaltyCards.join(', ') : 'not provided'}`);
      
      // Afficher l'overlay de pÃ©nalitÃ©
      setIsInPenalty(true);
      setFaultyCardIndex(cardIndex);
      
      // DÃ©terminer si c'est moi qui ai la pÃ©nalitÃ©
      const isMe = playerId === tableData?.currentUserId;
      console.log(`  â†’ Is it me? ${isMe}`);
      
      // DÃ©terminer quel joueur a la pÃ©nalitÃ© (pour l'affichage visuel)
      const penaltyPlayerKey = isMe 
        ? (amIPlayer1 ? 'player1' : 'player2')
        : (amIPlayer1 ? 'player2' : 'player1');
      setPenaltyPlayer(penaltyPlayerKey);
      
      // TOUS les joueurs doivent voir visuellement 2 cartes ajoutÃ©es
      console.log('  â†’ Checking penalty target...');
      if (!isMe) {
        // C'est l'ADVERSAIRE qui a la pÃ©nalitÃ©
        // DÃ©terminer quelle liste de cartes mettre Ã  jour en fonction de amIPlayer1
        console.log('  â†’ ðŸ¹ ADVERSAIRE has penalty - Updating opponent cards');
        
        if (amIPlayer1) {
          // Je suis player1 (en haut), l'adversaire est player2 (en bas)
          console.log('  â†’ I am player1, updating player2Cards (opponent)');
          setPlayer2Cards(prev => {
            console.log('  â†’ Inside setPlayer2Cards - Current length:', prev.length);
            
            // CrÃ©er un nouveau tableau avec le bon nombre de cartes
            let newCards = [...prev];
            
            // S'assurer que le tableau a exactement le bon nombre de cartes
            if (totalCards) {
              console.log(`  â†’ â— Checking card count: current=${newCards.length}, should be=${totalCards}`);
              
              // Si on a trop de cartes, on les supprime
              if (newCards.length > totalCards - (penaltyCards?.length || 2)) {
                console.log(`  â†’ â— Removing ${newCards.length - (totalCards - (penaltyCards?.length || 2))} excess cards`);
                newCards = newCards.slice(0, totalCards - (penaltyCards?.length || 2));
              }
              
              // Ajouter les cartes de pÃ©nalitÃ© avec leurs vraies valeurs
              if (penaltyCards && penaltyCards.length > 0) {
                console.log(`  â†’ â— Adding ${penaltyCards.length} penalty cards with real values: ${penaltyCards.join(', ')}`);
                penaltyCards.forEach((cardValue: number, idx: number) => {
                  newCards.push({
                    id: `penalty-opp-${Date.now()}-${idx}-${Math.random()}`,
                    value: cardValue,
                    isFlipped: false
                  });
                });
              } else {
                // Fallback si penaltyCards n'est pas dÃ©fini
                console.log(`  â†’ â— penaltyCards not provided, adding 2 generic cards`);
                while (newCards.length < totalCards) {
                  newCards.push({
                    id: `penalty-opp-${Date.now()}-${Math.random()}`,
                    value: -1,
                    isFlipped: false
                  });
                }
              }
            } else {
              // Si totalCards n'est pas dÃ©fini, on ajoute simplement 2 cartes
              console.log(`  â†’ â— totalCards not defined, adding 2 cards`);
              if (penaltyCards && penaltyCards.length > 0) {
                penaltyCards.forEach((cardValue: number, idx: number) => {
                  newCards.push({
                    id: `penalty-opp-${Date.now()}-${idx}`,
                    value: cardValue,
                    isFlipped: false
                  });
                });
              } else {
                newCards.push(
                  { id: `penalty-opp-${Date.now()}-1`, value: -1, isFlipped: false },
                  { id: `penalty-opp-${Date.now()}-2`, value: -1, isFlipped: false }
                );
              }
            }
            
            console.log('  â†’ Inside setPlayer2Cards - New length:', newCards.length);
            return newCards;
          });
          console.log('  â†’ setPlayer2Cards called!');
        } else {
          // Je suis player2 (en bas), l'adversaire est player1 (en haut)
          console.log('  â†’ I am player2, updating player1Cards (opponent)');
          setPlayer1Cards(prev => {
            console.log('  â†’ Inside setPlayer1Cards - Current length:', prev.length);
            
            // CrÃ©er un nouveau tableau avec le bon nombre de cartes
            let newCards = [...prev];
            
            // S'assurer que le tableau a exactement le bon nombre de cartes
            if (totalCards) {
              console.log(`  â†’ â— Checking card count: current=${newCards.length}, should be=${totalCards}`);
              
              // Si on a trop de cartes, on les supprime
              if (newCards.length > totalCards - (penaltyCards?.length || 2)) {
                console.log(`  â†’ â— Removing ${newCards.length - (totalCards - (penaltyCards?.length || 2))} excess cards`);
                newCards = newCards.slice(0, totalCards - (penaltyCards?.length || 2));
              }
              
              // Ajouter les cartes de pÃ©nalitÃ© avec leurs vraies valeurs
              if (penaltyCards && penaltyCards.length > 0) {
                console.log(`  â†’ â— Adding ${penaltyCards.length} penalty cards with real values: ${penaltyCards.join(', ')}`);
                penaltyCards.forEach((cardValue: number, idx: number) => {
                  newCards.push({
                    id: `penalty-opp-${Date.now()}-${idx}-${Math.random()}`,
                    value: cardValue,
                    isFlipped: false
                  });
                });
              } else {
                // Fallback si penaltyCards n'est pas dÃ©fini
                console.log(`  â†’ â— penaltyCards not provided, adding 2 generic cards`);
                while (newCards.length < totalCards) {
                  newCards.push({
                    id: `penalty-opp-${Date.now()}-${Math.random()}`,
                    value: -1,
                    isFlipped: false
                  });
                }
              }
            } else {
              // Si totalCards n'est pas dÃ©fini, on ajoute simplement 2 cartes
              console.log(`  â†’ â— totalCards not defined, adding 2 cards`);
              if (penaltyCards && penaltyCards.length > 0) {
                penaltyCards.forEach((cardValue: number, idx: number) => {
                  newCards.push({
                    id: `penalty-opp-${Date.now()}-${idx}`,
                    value: cardValue,
                    isFlipped: false
                  });
                });
              } else {
                newCards.push(
                  { id: `penalty-opp-${Date.now()}-1`, value: -1, isFlipped: false },
                  { id: `penalty-opp-${Date.now()}-2`, value: -1, isFlipped: false }
                );
              }
            }
            
            console.log('  â†’ Inside setPlayer1Cards - New length:', newCards.length);
            return newCards;
          });
          console.log('  â†’ setPlayer1Cards called!');
        }
      } else {
        // C'est MOI qui ai la pÃ©nalitÃ©
        // Mes vraies cartes seront ajoutÃ©es via handlePenaltyCardsReceived
        console.log('  â†’ ðŸŽ¯ I have penalty - Waiting for real penalty cards via game:penalty_cards_received');
      }
      
      // Attendre que les 2 cartes soient ajoutÃ©es (game:penalty_cards_received pour moi)
      // Puis retourner la carte fautive face cachÃ©e aprÃ¨s 1s
      setTimeout(() => {
        if (isMe) {
          // C'est moi qui ai la pÃ©nalitÃ© - retourner la carte fautive face cachÃ©e
          // Je suis TOUJOURS affichÃ© en bas (player2Cards)
          setPlayer2Cards(prev => prev.map((card, idx) => 
            idx === cardIndex ? { ...card, isFlipped: false } : card
          ));
        } else {
          // C'est l'adversaire - retourner la carte fautive face cachÃ©e
          // L'adversaire est TOUJOURS affichÃ© en haut (player1Cards)
          setPlayer1Cards(prev => prev.map((card, idx) => 
            idx === cardIndex ? { ...card, isFlipped: false } : card
          ));
        }
      }, 1000);
      
      // Attendre 3 secondes puis retirer les overlays
      await new Promise(resolve => setTimeout(resolve, 3000));
      setPenaltyCue(false);
      setShowPenaltyDim(false);
      setIsInPenalty(false);
      setPenaltyPlayer(null);
      
      console.log(`âœ… Penalty animation completed for ${playerName}`);
    };

    // Ã‰couter l'activation des pouvoirs des cartes figures
    const handlePowerActivated = (data: any) => {
      console.log('ðŸ‘‘ Power activated event received:', data);
      const { playerId, powerType, message } = data;
      
      // Afficher un message pour indiquer que le pouvoir est activÃ©
      console.log(`  â†’ ${message}`);
      
      // IMPORTANT: Ne mettre Ã  jour l'Ã©tat local QUE si c'est un autre joueur qui active un pouvoir
      // Si c'est nous qui activons le pouvoir, nous avons dÃ©jÃ  mis Ã  jour l'Ã©tat localement
      if (playerId !== tableData?.currentUserId) {
        console.log(`  â†’ Autre joueur (${playerId}) a activÃ© le pouvoir ${powerType}`);
        if (powerType === 'jack') {
          setIsJackPowerActive(true);
          setJackCue(true);
          setTimeout(() => setJackCue(false), 900);
        } else if (powerType === 'queen') {
          setIsQueenPowerActive(true);
          setQueenCue(true);
          setTimeout(() => setQueenCue(false), 900);
        } else if (powerType === 'king') {
          setIsKingPowerActive(true);
          setKingSelections([]);
          setPowerCue(true);
          setTimeout(() => setPowerCue(false), 900);
        }
      } else {
        console.log(`  â†’ C'est moi qui ai activÃ© le pouvoir ${powerType}, pas besoin de mettre Ã  jour l'Ã©tat local`);
      }
      
      // Le serveur va envoyer une mise Ã  jour du minuteur avec phase='power_active'
    };
    
    // Ã‰couter l'Ã©change de cartes avec le pouvoir du Roi
    const handleKingSwapCards = (data: any) => {
      console.log('ðŸ‘‘ King swap cards event received:', data);
      const { playerId, card1, card2 } = data;
      
      // Ne pas traiter notre propre Ã©vÃ©nement (dÃ©jÃ  appliquÃ© localement)
      if (playerId === tableData?.currentUserId) {
        console.log('  â†’ Ignoring my own king swap event');
        return;
      }
      
      console.log('  â†’ Processing king swap from other player');
      console.log('  â†’ Card 1:', card1);
      console.log('  â†’ Card 2:', card2);
      
      // IMPORTANT: Inverser les positions car l'autre joueur voit le plateau Ã  l'envers
      // Si l'autre joueur dit 'top', c'est 'bottom' pour nous, et vice versa
      const invertPosition = (pos: 'top' | 'bottom'): 'top' | 'bottom' => {
        return pos === 'top' ? 'bottom' : 'top';
      };
      
      // Fonction pour appliquer l'Ã©change sur une carte
      const applySwap = (p: 'top'|'bottom', idx: number, newVal: number) => {
        // Inverser la position car l'autre joueur voit le plateau Ã  l'envers
        const adjustedPosition = invertPosition(p);
        console.log(`  â†’ Original position: ${p}, Adjusted position: ${adjustedPosition}`);
        console.log(`  â†’ Applying swap to ${adjustedPosition} card at index ${idx}, new value: ${newVal}`);
        
        if (adjustedPosition === 'top') {
          setPlayer1Cards(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], value: newVal, isFlipped: false };
            return next;
          });
        } else {
          setPlayer2Cards(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], value: newVal, isFlipped: false };
            return next;
          });
        }
      };
      
      // Appliquer les Ã©changes en inversant les positions
      applySwap(card1.position, card1.index, card1.newValue);
      applySwap(card2.position, card2.index, card2.newValue);
      
      console.log('  â†’ King swap applied successfully on my side');
    };
    
    // Ã‰couter la dÃ©claration de Bombom
    const handleBombomDeclared = (data: any) => {
      console.log('ðŸ¬ Bombom declared event received:', data);
      const { playerId, player } = data;
      
      // Ne pas traiter notre propre Ã©vÃ©nement (dÃ©jÃ  appliquÃ© localement)
      if (playerId === tableData?.currentUserId) {
        console.log('  â†’ Ignoring my own bombom declaration event');
        return;
      }
      
      console.log('  â†’ Processing bombom declaration from other player');
      
      // Mettre Ã  jour l'Ã©tat local pour refuser d'autres dÃ©clarations Bombom
      setBombomDeclaredBy(player);
      
      // Afficher un message temporaire
      const who = player === 'player1' ? 'Joueur 1' : 'Joueur 2';
      setQuickDiscardFlash(`${who} a dÃ©clarÃ© Bombom!`);
      setTimeout(() => setQuickDiscardFlash(null), 1000);
    };
    
    // Ã‰couter l'annulation de Bombom
    const handleBombomCancelled = (data: any) => {
      console.log('ðŸ¬ Bombom cancelled event received:', data);
      const { playerId, player } = data;
      
      // Ne pas traiter notre propre Ã©vÃ©nement (dÃ©jÃ  appliquÃ© localement)
      if (playerId === tableData?.currentUserId) {
        console.log('  â†’ Ignoring my own bombom cancellation event');
        return;
      }
      
      console.log('  â†’ Processing bombom cancellation from other player');
      
      // Mettre Ã  jour l'Ã©tat local pour rÃ©initialiser le Bombom
      setBombomDeclaredBy(null);
      
      // Mettre Ã  jour l'Ã©tat d'annulation pour ce joueur
      setBombomCancelUsed(prev => ({ ...prev, [player]: true }));
      
      // Afficher un message temporaire
      const who = player === 'player1' ? 'Joueur 1' : 'Joueur 2';
      setQuickDiscardFlash(`${who} a annulÃ© son Bombom!`);
      setTimeout(() => setQuickDiscardFlash(null), 1000);
    };
    
    // Ã‰couter le prompt Bombom (quand le tour revient au joueur qui a dÃ©clarÃ© Bombom)
    const handleBombomPrompt = (data: any) => {
      console.log('ðŸ¬ Bombom prompt received:', data);
      const { player, playerId } = data;
      
      // VÃ©rifier si c'est bien pour ce joueur
      if (playerId && playerId !== tableData?.currentUserId) {
        console.log('ðŸ¬ Bombom prompt not for this player, ignoring');
        return;
      }
      
      // ArrÃªter tous les timers pour Ã©viter les conflits
      if (timerRef.current) {
        console.log('ðŸ¬ Stopping game timer for Bombom prompt');
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // ArrÃªter un Ã©ventuel timer Bombom prÃ©cÃ©dent
      if (bombomTimerRef.current) {
        clearTimeout(bombomTimerRef.current);
        bombomTimerRef.current = null;
      }
      
      // DÃ©sactiver l'Ã©tat de tour du joueur pour bloquer les actions
      setIsPlayerTurn(false);
      
      // VÃ©rifier si l'annulation a dÃ©jÃ  Ã©tÃ© utilisÃ©e
      const myPlayerKey = amIPlayer1 ? 'player1' : 'player2';
      const canCancel = !bombomCancelUsed[myPlayerKey];
      console.log('ðŸ¬ Bombom cancel state:', { myPlayerKey, canCancel, bombomCancelUsed });
      
      if (!canCancel) {
        // Si l'annulation a dÃ©jÃ  Ã©tÃ© utilisÃ©e, dÃ©clencher ShowTime directement
        console.log('ðŸ¬ Annulation dÃ©jÃ  utilisÃ©e, dÃ©clenchement automatique de ShowTime');
        // Fermer d'abord le prompt s'il est ouvert
        setShowShowTimePrompt(false);
        // Puis dÃ©clencher ShowTime aprÃ¨s une courte pause
        setTimeout(() => triggerShowTime(), 50);
      } else {
        // Sinon, afficher le prompt ShowTime
        console.log('ðŸ¬ Showing ShowTime prompt for player', player);
        setShowShowTimePrompt(true);
        
        // DÃ©marrer un timer de 5 secondes pour dÃ©clencher automatiquement ShowTime si le joueur ne fait rien
        console.log('ðŸ•” Starting 5-second timer for automatic ShowTime');
        bombomTimerRef.current = setTimeout(() => {
          console.log('ðŸ•” Bombom prompt timeout - Triggering ShowTime automatically');
          setShowShowTimePrompt(false);
          setTimeout(() => triggerShowTime(), 50);
        }, 5000); // 5 secondes
      }
    };
    
    // Ã‰couter la fin des pouvoirs des cartes figures
    const handlePowerCompleted = (data: any) => {
      console.log('ðŸ‘‘ Power completed event received:', data);
      const { playerId, powerType, message } = data;
      
      // Afficher un message pour indiquer que le pouvoir est terminÃ©
      console.log(`  â†’ ${message}`);
      
      // RÃ©initialiser les Ã©tats des pouvoirs, peu importe qui a terminÃ© le pouvoir
      if (powerType === 'jack') {
        setIsJackPowerActive(false);
        // RÃ©initialiser la rÃ©fÃ©rence et le blocage global pour permettre une nouvelle activation du pouvoir
        jackPowerUsedRef.current = false;
        setJackCardSelected(false);
        setAnyPowerActive(false); // RÃ©initialiser la variable pour permettre l'affichage du menu
        console.log('  â†’ Jack power reference and global block reset');
      } else if (powerType === 'queen') {
        setIsQueenPowerActive(false);
        // RÃ©initialiser le blocage global pour permettre une nouvelle activation du pouvoir
        setQueenCardSelected(false);
        setAnyPowerActive(false); // RÃ©initialiser la variable pour permettre l'affichage du menu
        console.log('  â†’ Queen power global block reset');
      } else if (powerType === 'king') {
        setIsKingPowerActive(false);
        setKingPowerActivated(false); // RÃ©initialiser la variable pour permettre une nouvelle activation
        setAnyPowerActive(false); // RÃ©initialiser la variable pour permettre l'affichage du menu
        setKingSelections([]);
      }
      
      // Si c'est un autre joueur qui a terminÃ© son pouvoir, s'assurer que l'Ã©tat local est cohÃ©rent
      if (playerId !== tableData?.currentUserId) {
        setDrawnCard(null);
        setShowCardActions(false);
      }
      
      // Forcer la mise Ã  jour du timer pour Ã©viter l'affichage de 30 secondes
      // Le serveur va envoyer une mise Ã  jour du minuteur avec phase='game'
      // mais on force une mise Ã  jour immÃ©diate pour Ã©viter un dÃ©lai
      setTimerPhase('game');
      setTimeLeft(5); // Valeur par dÃ©faut du timer de jeu
    };

    // Ã‰couter l'arrÃªt des timers (lors du ShowTime)
    const handleTimersStopped = (data: any) => {
      console.log('â¹ï¸ Timers stopped event received:', data);
      
      // ArrÃªter tous les timers locaux
      if (timerRef.current) {
        console.log('â¹ï¸ Stopping local game timer');
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (beforeRoundTimerRef.current) {
        console.log('â¹ï¸ Stopping local memorization timer');
        clearInterval(beforeRoundTimerRef.current);
        beforeRoundTimerRef.current = null;
      }
      
      // Figer l'affichage du timer
      setTimeLeft(0);
    };
    
    // Ã‰couter les mises Ã  jour des timers
    const handleTimerUpdate = (data: any) => {
      console.log('â±ï¸ Timer update:', data);
      const { phase, memoTimeLeft: memo, gameTimeLeft: game, choiceTimeLeft: choice } = data;
      
      // IMPORTANT: ArrÃªter TOUS les timers locaux pour Ã©viter les chevauchements
      if (timerRef.current) {
        console.log('â¸ï¸ Stopping local game timer due to server timer update');
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (beforeRoundTimerRef.current) {
        console.log('â¸ï¸ Stopping local memorization timer due to server timer update');
        clearInterval(beforeRoundTimerRef.current);
        beforeRoundTimerRef.current = null;
      }
      
      // Ne pas mettre Ã  jour les timers si ShowTime est en cours
      if (showShowTimePrompt) {
        console.log('ðŸ¬ ShowTime prompt actif, ignorer la mise Ã  jour des timers');
        return;
      }
      
      setTimerPhase(phase);
      setMemoTimeLeft(memo);
      setGameTimeLeft(game);
      setChoiceTimeLeft(choice);
      
      // Mettre Ã  jour timeLeft pour l'affichage (selon la phase active)
      if (phase === 'memorization') {
        console.log(`  â†’ Setting timeLeft to ${memo} (memorization)`);
        setTimeLeft(memo);
        
        // Si la mÃ©morisation se termine, retourner toutes les cartes face cachÃ©e
        if (memo === 0) {
          console.log('âœ… Memorization phase ended - Starting game');
          setIsMemorizationPhase(false);
          setPlayer1Cards(cards => cards.map(c => ({ ...c, isFlipped: false })));
          setPlayer2Cards(cards => cards.map(c => ({ ...c, isFlipped: false })));
          setMemorizedCardsCount(0);
          setMemorizedCardIndexes([]);
          
          // Activer la dÃ©fausse rapide
          setQuickDiscardActive(true);
          console.log('âœ… Quick discard activated');
          
          // Afficher "MÃ©morisation terminÃ©e" pendant 1.5s
          setShowMemorizationEndOverlay(true);
          setTimeout(() => {
            setShowMemorizationEndOverlay(false);
          }, 1500);
        }
      } else if (phase === 'game') {
        console.log(`  â†’ Setting timeLeft to ${game} (game), isPlayerTurn: ${isPlayerTurnRef.current}`);
        setTimeLeft(game);
        
        // Si le timer de jeu arrive Ã  0 ET que c'est mon tour, Ã©mettre le timeout
        if (game === 0 && isPlayerTurnRef.current) {
          console.log('â° Game timer expired - emitting turn timeout');
          socket.emit('game:turn_timeout', {
            tableId: tableData?.tableId,
            userId: tableData?.currentUserId
          });
        }
      } else if (phase === 'choice') {
        setTimeLeft(choice);
        
        // Si le timer de choix arrive Ã  0 ET que j'ai une carte piochÃ©e, Ã©mettre le timeout
        if (choice === 0 && drawnCardRef.current) {
          console.log('â° Choice timer expired - emitting choice timeout');
          console.log('  â†’ drawnCard value:', drawnCardRef.current.value);
          socket.emit('game:choice_timeout', {
            tableId: tableData?.tableId,
            userId: myPlayerInfo?.userId,
            drawnCard: drawnCardRef.current.value
          });
        } else if (choice === 0 && !drawnCardRef.current) {
          console.log('âš ï¸ Choice timer expired but no drawnCard!');
        }
      } else if (phase === 'power_active') {
        // Pendant l'activation d'un pouvoir, on affiche un minuteur fixe
        setTimeLeft(30); // Valeur arbitraire pour montrer que le timer est en pause
        console.log('ðŸ‘‘ Power active phase - timer paused');
      }
    };
    
    // Retirer TOUS les anciens listeners pour Ã©viter les doublons
    // On utilise socket.off(event) sans handler pour retirer TOUS les listeners de cet Ã©vÃ©nement
    socket.off('player:ready_changed');
    socket.off('game:auto_start');
    socket.off('game:cards_dealt');
    socket.off('game:player_quit');
    socket.off('game:turn_changed');
    socket.off('game:card_drawn');
    socket.off('game:opponent_drew_card');
    socket.off('game:card_discarded');
    socket.off('game:card_replaced');
    socket.off('game:penalty_cards_received');
    socket.off('game:quick_discard_penalty_applied');
    socket.off('game:power_activated');
    socket.off('game:power_completed');
    socket.off('game:king_swap_cards');
    socket.off('game:timer_update');
    
    // Enregistrer les nouveaux listeners
    socket.on('player:ready_changed', handleReadyChanged);
    socket.on('game:auto_start', handleAutoStart);
    socket.on('game:cards_dealt', handleCardsDealt);
    socket.on('game:player_quit', handlePlayerQuit);
    socket.on('game:turn_changed', handleTurnChanged);
    socket.on('game:card_drawn', handleCardDrawn);
    socket.on('game:opponent_drew_card', handleOpponentDrewCard);
    socket.on('game:card_discarded', handleCardDiscarded);
    socket.on('game:card_replaced', handleCardReplaced);
    socket.on('game:penalty_cards_received', handlePenaltyCardsReceived);
    socket.on('game:quick_discard_penalty_applied', handleQuickDiscardPenaltyApplied);
    socket.on('game:power_activated', handlePowerActivated);
    socket.on('game:power_completed', handlePowerCompleted);
    socket.on('game:king_swap_cards', handleKingSwapCards);
    socket.on('game:timer_update', handleTimerUpdate);
    socket.on('game:bombom_declared', handleBombomDeclared);
    socket.on('game:bombom_cancelled', handleBombomCancelled);
    socket.on('game:bombom_prompt', handleBombomPrompt);
    socket.on('game:timers_stopped', handleTimersStopped);
    socket.on('game:showtime', handleShowTime);

    return () => {
      // Retirer TOUS les listeners sans passer les handlers
      socket.off('playerJoined');
      socket.off('table_updated');
      socket.off('player:ready_changed');
      socket.off('game:auto_start');
      socket.off('game:cards_dealt');
      socket.off('game:player_quit');
      socket.off('game:turn_changed');
      socket.off('game:card_drawn');
      socket.off('game:opponent_drew_card');
      socket.off('game:card_discarded');
      socket.off('game:card_replaced');
      socket.off('game:penalty_cards_received');
      socket.off('game:quick_discard_penalty_applied');
      socket.off('game:power_activated');
      socket.off('game:power_completed');
      socket.off('game:king_swap_cards');
      socket.off('game:timer_update');
      socket.off('game:bombom_declared');
      socket.off('game:bombom_cancelled');
      socket.off('game:bombom_prompt');
      socket.off('game:timers_stopped');
      socket.off('game:showtime');
      socket.emit('leaveTableRoom', tableData.tableId);
      hasJoinedRoom.current = false; // RÃ©initialiser pour permettre de rejoindre si on revient
    };
  }, [socket, tableData?.tableId, tableData?.currentUserId, navigate]);
}
