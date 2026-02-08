import React from 'react';

export function useCardActions(params: any) {
  const {
    socket,
    tableData,
    amIPlayer1,
    currentPlayer,
    gamePhase,
    isPlayerTurn,
    drawnCard,
    discardPile,
    selectingCardToReplace,
    isInPenalty,
    bombomDeclaredBy,
    bombomCancelUsed,
    showShowTimePrompt,
    bombomTimerRef,
    timerRef,
    startTurnTimer,
    setBombomDeclaredBy,
    setBombomTurnPassedToOpponent,
    setQuickDiscardFlash,
    setBombomCancelUsed,
    setShowShowTimePrompt,
    setIsPlayerTurn,
    setDrawnCard,
    player1Cards,
    player2Cards,
    cardsFlipped,
    myPlayerInfo,
    setPlayer1Cards,
    setPlayer2Cards,
    isMemorizationPhase,
    memorizedCardsCount,
    memorizedCardIndexes,
    setMemorizedCardIndexes,
    setMemorizedCardsCount,
    quickDiscardActive,
    discardRef,
    setReplaceOutImage,
    setReplaceOutAnim,
    setReplaceInAnim,
    setReplaceInImage,
    setSwapAnimA,
    setSwapAnimB,
    setDiscardPile,
    setShowCardActions,
    setSelectingCardToReplace,
    setIsKingPowerActive,
    setKingPowerActivated,
    setAnyPowerActive,
    setKingSelections,
    setPowerCue,
    setIsQueenPowerActive,
    setQueenCue,
    setIsJackPowerActive,
    setJackCue,
    jackPowerUsedRef,
    kingPowerActivated,
    isKingPowerActive,
    kingSelections,
    queenCardSelected,
    jackCardSelected,
    isPowerfulMode,
    setWinner,
    setShowVictory,
    setScores,
    setShowScoreboard,
    setQuickDiscardActive,
    getCardImage,
    getCardValue,
    getRankLabel,
    getCardScore,
    isJoker,
    deckRef,
    player1HandRef,
    player2HandRef,
    setCardsFlipped,
  } = params;
  const canDeclareBombomFor = React.useCallback((player: 'player1' | 'player2') => {
    // VÃ©rifier si c'est le tour du joueur correspondant
    const correctPhase = (gamePhase === 'player1_turn' && player === 'player1') || (gamePhase === 'player2_turn' && player === 'player2');
    
    // DÃ©clarable uniquement pendant le tour du joueur, sans action en cours, et si aucun Bombom actif
    return correctPhase && isPlayerTurn && drawnCard === null && !selectingCardToReplace && !isInPenalty && bombomDeclaredBy === null;
  }, [gamePhase, isPlayerTurn, drawnCard, selectingCardToReplace, isInPenalty, bombomDeclaredBy]);

  const handleDeclareBombomFor = React.useCallback((player: 'player1' | 'player2') => {
    console.log('ðŸ¬ Tentative de dÃ©claration Bombom pour', player);
    
    // VÃ©rifier si le joueur peut dÃ©clarer Bombom
    if (!canDeclareBombomFor(player)) {
      console.log('ðŸ”´ Impossible de dÃ©clarer Bombom:', { 
        player, 
        gamePhase, 
        isPlayerTurn, 
        drawnCard, 
        selectingCardToReplace, 
        isInPenalty, 
        bombomDeclaredBy 
      });
      return;
    }
    
    // Mettre Ã  jour l'Ã©tat pour indiquer que Bombom a Ã©tÃ© dÃ©clarÃ©
    setBombomDeclaredBy(player);
    // RÃ©initialiser le suivi du tour passÃ© Ã  l'adversaire
    setBombomTurnPassedToOpponent(false);
    
    // Informer le serveur de la dÃ©claration Bombom
    if (socket && tableData?.tableId) {
      socket.emit('game:bombom_declared', {
        tableId: tableData.tableId,
        userId: tableData.currentUserId,
        player: player
      });
    }
    
    // Afficher un message temporaire
    const who = player === 'player1' ? 'Joueur 1' : 'Joueur 2';
    setQuickDiscardFlash(`${who} a dÃ©clarÃ© Bombom!`);
    setTimeout(() => setQuickDiscardFlash(null), 1000);
  }, [canDeclareBombomFor, socket, tableData]);

  const handleCancelBombom = React.useCallback(() => {
    // DÃ©terminer quel joueur je suis
    const myPlayerKey = amIPlayer1 ? 'player1' : 'player2';
    
    // Annuler seulement lors du prompt au retour du tour, et seulement une fois par joueur
    if (!showShowTimePrompt) return;
    if (bombomCancelUsed[myPlayerKey]) return;
    
    console.log('ðŸ”„ Cancelling Bombom declaration');
    console.log('  â†’ myPlayerKey:', myPlayerKey);
    console.log('  â†’ bombomCancelUsed:', bombomCancelUsed);
    
    // ArrÃªter le timer Bombom s'il est en cours
    if (bombomTimerRef.current) {
      console.log('ðŸ•” Stopping Bombom auto-ShowTime timer');
      clearTimeout(bombomTimerRef.current);
      bombomTimerRef.current = null;
    }
    
    // Mettre Ã  jour l'Ã©tat local
    setBombomCancelUsed(prev => ({ ...prev, [myPlayerKey]: true }));
    setBombomDeclaredBy(null);
    setShowShowTimePrompt(false);
    
    // Reprendre le tour normalement
    setIsPlayerTurn(true);
    
    // IMPORTANT: ArrÃªter tous les timers locaux pour Ã©viter les chevauchements
    if (timerRef.current) {
      console.log('â¸ï¸ Stopping local game timer');
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // IMPORTANT: Informer le serveur que le Bombom a Ã©tÃ© annulÃ©
    if (tableData?.tableId && tableData?.currentUserId && socket) {
      console.log('ðŸ¬ Emitting game:cancel_bombom to server');
      socket.emit('game:cancel_bombom', {
        tableId: tableData.tableId,
        userId: tableData.currentUserId,
        player: myPlayerKey
      });
      
      // Puis demander au serveur de dÃ©marrer un nouveau tour
      console.log('ðŸ’¬ Emitting game:start_turn to server');
      socket.emit('game:start_turn', {
        tableId: tableData.tableId,
        userId: tableData.currentUserId,
        currentPlayerId: tableData.currentUserId
      });
    } else {
      // Mode local seulement (fallback)
      console.log('âš ï¸ No tableData or socket available, using local timer');
      startTurnTimer();
    }
  }, [showShowTimePrompt, bombomDeclaredBy, currentPlayer, bombomCancelUsed, socket, tableData]);

  // utilitaires dÃ©placÃ©s dans ../utils/cards


  // GÃ¨re le clic sur une carte
  const handleCardClick = async (player: 'top' | 'bottom', index: number) => {
    // VÃ©rifie si l'index est valide
    const handLength = (player === 'top' ? player1Cards.length : player2Cards.length);
    // Bloquer tous les clics si une carte a dÃ©jÃ  Ã©tÃ© sÃ©lectionnÃ©e avec le pouvoir du Valet ou de la Dame
    if (index < 0 || index >= handLength || isInPenalty || jackCardSelected || queenCardSelected) return;
    
    const playerKey = player === 'top' ? 'player1' : 'player2';
    const playerCards = player === 'top' ? player1Cards : player2Cards;
    
    // PHASE DE MÃ‰MORISATION : Cliquer sur 2 cartes maximum (seulement SES cartes = bottom)
    if (isMemorizationPhase && player === 'bottom') {
      // Si dÃ©jÃ  2 cartes mÃ©morisÃ©es, ne rien faire
      if (memorizedCardsCount >= 2) {
        console.log('âš ï¸ Already memorized 2 cards');
        return;
      }
      
      // Si cette carte est dÃ©jÃ  mÃ©morisÃ©e, la retourner
      if (memorizedCardIndexes.includes(index)) {
        console.log(`ðŸ”„ Flipping card ${index} back`);
        setPlayer2Cards(prev => {
          const newCards = [...prev];
          newCards[index] = { ...newCards[index], isFlipped: false };
          return newCards;
        });
        setMemorizedCardIndexes(prev => prev.filter(i => i !== index));
        setMemorizedCardsCount(prev => prev - 1);
        return;
      }
      
      // Retourner la carte pour la voir
      console.log(`ðŸ‘ï¸ Memorizing card ${index}`);
      setPlayer2Cards(prev => {
        const newCards = [...prev];
        newCards[index] = { ...newCards[index], isFlipped: true };
        return newCards;
      });
      setMemorizedCardIndexes(prev => [...prev, index]);
      setMemorizedCardsCount(prev => prev + 1);
      return;
    }
    
    // Ne pas permettre de cliquer sur les cartes adverses pendant la mÃ©morisation
    if (isMemorizationPhase && player === 'top') {
      console.log('âš ï¸ Cannot click opponent cards during memorization');
      return;
    }
    
    // Mode Powerful: dÃ©fausser immÃ©diatement la carte cliquÃ©e (si non vide)
    if (isPowerfulMode) {
      if (playerCards[index].value === -1) return;
      // Retourner la carte briÃ¨vement (facultatif)
      if (player === 'top') {
        setPlayer1Cards(prev => {
          const newCards = [...prev];
          newCards[index] = { ...newCards[index], isFlipped: true };
          return newCards;
        });
      } else {
        setPlayer2Cards(prev => {
          const newCards = [...prev];
          newCards[index] = { ...newCards[index], isFlipped: true };
          return newCards;
        });
      }

      const newCardsLocal = [...playerCards];
      const discardedCard = newCardsLocal[index].value;
      // Animation: carte depuis la main vers la dÃ©fausse (1s)
      try {
        const oldCard = playerCards[index];
        const oldCardId = oldCard.id;
        let selEl = document.querySelector(`[data-player="${player}"][data-card-id="${oldCardId}"]`) as HTMLElement | null;
        if (!selEl) {
          selEl = document.querySelector(`[data-player="${player}"][data-card-index="${index}"]`) as HTMLElement | null;
        }
        const discardRect = discardRef.current?.getBoundingClientRect();
        if (selEl && discardRect) {
          selEl.style.visibility = 'hidden';
          const selRect = selEl.getBoundingClientRect();
          const selCenter = { x: selRect.left + selRect.width / 2, y: selRect.top + selRect.height / 2 };
          const discardCenter = { x: discardRect.left + discardRect.width / 2, y: discardRect.top + discardRect.height / 2 };

          setReplaceOutImage(getCardImage(discardedCard));
          setReplaceOutAnim({ from: selCenter, to: discardCenter, toPlayer: player, index, cardValue: discardedCard });
          await new Promise(resolve => setTimeout(resolve, 1000));
          setReplaceOutAnim(null);
          setReplaceOutImage(null);
        }
      } catch {}

      // Mettre Ã  jour la dÃ©fausse (aprÃ¨s l'animation)
      setDiscardPile(discardedCard);
      if (quickDiscardActive) {
        const rank = getRankLabel(discardedCard);
        const who = (player === 'top') ? 'Joueur 1' : 'Joueur 2';
        setQuickDiscardFlash(`${who} a jetÃ© ${rank}`);
        setTimeout(() => setQuickDiscardFlash(null), 1000);
      }

      // Retirer la carte du jeu
      if (player === 'top') {
        setPlayer1Cards(prev => {
          const updatedCards = [...prev];
          updatedCards[index] = { ...updatedCards[index], value: -1, isFlipped: false };
          return updatedCards;
        });
      } else {
        setPlayer2Cards(prev => {
          const updatedCards = [...prev];
          updatedCards[index] = { ...updatedCards[index], value: -1, isFlipped: false };
          return updatedCards;
        });
      }

      // VÃ©rifier la victoire (ignorer pendant un remplacement en cours)
      if (selectingCardToReplace) {
        return;
      }
      // VÃ©rifier la victoire
      const remainingCards = newCardsLocal.filter(card => card.value !== -1).length - 1; // on vient d'enlever 1
      if (remainingCards === 0) {
        setWinner(playerKey);
        setShowVictory(true);
        setIsPlayerTurn(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        // Calculer le score Ã  ajouter pour le perdant (somme de ses cartes restantes)
        const loserKey: 'player1'|'player2' = playerKey === 'player1' ? 'player2' : 'player1';
        const loserCardsArr = loserKey === 'player1' ? player1Cards : player2Cards;
        const loserScoreToAdd = loserCardsArr.reduce((sum, c) => sum + getCardScore(c.value), 0);
        setTimeout(() => {
          setShowVictory(false);
          setScores(prev => ({
            player1: prev.player1 + (loserKey === 'player1' ? loserScoreToAdd : 0),
            player2: prev.player2 + (loserKey === 'player2' ? loserScoreToAdd : 0)
          }));
          setShowScoreboard(true);
        }, 3000);
      }
      return;
    }
    
    // Mode pouvoir du Roi: sÃ©lectionner 2 cartes et les Ã©changer
    if (isKingPowerActive) {
      const sourceCards = player === 'top' ? player1Cards : player2Cards;
      // Ne pas permettre de sÃ©lectionner un slot vide
      if (sourceCards[index].value === -1) return;
      // EmpÃªcher double sÃ©lection du mÃªme slot
      if (kingSelections.length === 1 && kingSelections[0].player === player && kingSelections[0].index === index) return;

      // Enregistrer la sÃ©lection
      const newSel = [...kingSelections, { player, index }];
      setKingSelections(newSel);

      // Si c'est la 1Ã¨re sÃ©lection, attendre la seconde
      if (newSel.length < 2) {
        return;
      }

      // Nous avons 2 sÃ©lections, lancer l'animation d'Ã©change puis dÃ©fausser le Roi
      const selA = newSel[0];
      const selB = newSel[1];

      try {
        // RÃ©cupÃ©rer les Ã©lÃ©ments DOM et positions
        const getEl = (p: 'top'|'bottom', idx: number, id: string | undefined) => {
          let el: HTMLElement | null = null;
          if (id) {
            el = document.querySelector(`[data-player="${p}"][data-card-id="${id}"]`) as HTMLElement | null;
          }
          if (!el) {
            el = document.querySelector(`[data-player="${p}"][data-card-index="${idx}"]`) as HTMLElement | null;
          }
          return el;
        };

        const aCards = selA.player === 'top' ? player1Cards : player2Cards;
        const bCards = selB.player === 'top' ? player1Cards : player2Cards;
        const aCard = aCards[selA.index];
        const bCard = bCards[selB.index];
        const aEl = getEl(selA.player, selA.index, aCard?.id);
        const bEl = getEl(selB.player, selB.index, bCard?.id);
        if (!aEl || !bEl) {
          // SÃ©curitÃ©: si pas d'Ã©lÃ©ments, on fait un swap logique sans animation
          await new Promise(r => setTimeout(r, 50));
        } else {
          // Masquer les sources
          aEl.style.visibility = 'hidden';
          bEl.style.visibility = 'hidden';
          const ar = aEl.getBoundingClientRect();
          const br = bEl.getBoundingClientRect();
          const aCenter = { x: ar.left + ar.width/2, y: ar.top + ar.height/2 };
          const bCenter = { x: br.left + br.width/2, y: br.top + br.height/2 };
          // Lancer deux cartes en vol (face down)
          setSwapAnimA({ from: aCenter, to: bCenter, toPlayer: selB.player, index: selB.index, cardValue: -1 });
          setSwapAnimB({ from: bCenter, to: aCenter, toPlayer: selA.player, index: selA.index, cardValue: -1 });
          await new Promise(r => setTimeout(r, 1000));
          setSwapAnimA(null);
          setSwapAnimB(null);
          // RÃ©afficher les slots aprÃ¨s le swap
          aEl.style.visibility = '';
          bEl.style.visibility = '';
        }

        // Appliquer l'Ã©change logique (valeurs et face cachÃ©e)
        const applySwap = (p: 'top'|'bottom', idx: number, newVal: number) => {
          if (p === 'top') {
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

        applySwap(selA.player, selA.index, bCard.value);
        applySwap(selB.player, selB.index, aCard.value);

        // Notifier le serveur de l'Ã©change pour synchroniser l'autre joueur
        if (socket) {
          console.log('ðŸ‘‘ Roi: Notification au serveur de l\'Ã©change de cartes');
          
          // Approche simplifiÃ©e : envoyer simplement les indices et valeurs des cartes
          // Chaque client appliquera les changements selon sa propre perspective
          socket.emit('game:king_swap_cards', {
            tableId: tableData?.tableId,
            userId: tableData?.currentUserId,
            // Envoyer les informations des cartes Ã©changÃ©es
            card1: { index: selA.index, position: selA.player, oldValue: aCard.value, newValue: bCard.value },
            card2: { index: selB.index, position: selB.player, oldValue: bCard.value, newValue: aCard.value }
          });
          
          console.log('ðŸ‘‘ Ã‰vÃ©nement game:king_swap_cards Ã©mis avec les informations suivantes:');
          console.log(`  â†’ Carte 1: index=${selA.index}, position=${selA.player}, oldValue=${aCard.value}, newValue=${bCard.value}`);
          console.log(`  â†’ Carte 2: index=${selB.index}, position=${selB.player}, oldValue=${bCard.value}, newValue=${aCard.value}`);
        }

        // Attendre un tick pour que le DOM reflÃ¨te le swap avant la dÃ©fausse du Roi
        await new Promise(requestAnimationFrame);

        // DÃ©fausser le Roi piochÃ© avec animation deck -> dÃ©fausse
        if (drawnCard) {
          const deckRect = deckRef.current?.getBoundingClientRect();
          const discardRect = discardRef.current?.getBoundingClientRect();
          if (deckRect && discardRect) {
            const deckCenter = { x: deckRect.left + deckRect.width / 2, y: deckRect.top + deckRect.height / 2 };
            const discardCenter = { x: discardRect.left + discardRect.width / 2, y: discardRect.top + discardRect.height / 2 };
            setReplaceOutImage(getCardImage(drawnCard.value));
            setReplaceOutAnim({ from: deckCenter, to: discardCenter, toPlayer: currentPlayer === 'player1' ? 'top' : 'bottom', index: -1, cardValue: drawnCard.value });
            await new Promise(resolve => setTimeout(resolve, 1000));
            setReplaceOutAnim(null);
            setReplaceOutImage(null);
          }
          setDiscardPile(drawnCard.value);
        }

        // Reset des Ã©tats et fin de tour
        setDrawnCard(null);
        setShowCardActions(false);
        setIsKingPowerActive(false);
        setKingPowerActivated(false); // RÃ©initialiser pour permettre une nouvelle activation
        setKingSelections([]);
        
        // Notifier le serveur que le pouvoir est terminÃ©
        if (socket) {
          socket.emit('game:power_completed', {
            tableId: tableData?.tableId,
            userId: tableData?.currentUserId,
            powerType: 'king'
          });
          
          // DÃ©fausser le Roi
          if (drawnCard) {
            socket.emit('game:discard_card', {
              tableId: tableData?.tableId,
              userId: tableData?.currentUserId,
              cardIndex: -1, // -1 = carte piochÃ©e (pas encore dans la main)
              card: drawnCard.value
            });
          }
        }
      } catch (e) {
        // En cas d'erreur, reset du mode
        setIsKingPowerActive(false);
        setKingPowerActivated(false); // RÃ©initialiser pour permettre une nouvelle activation
        setKingSelections([]);
        console.error('ðŸ‘‘ Erreur lors de l\'application du pouvoir du Roi:', e);
      }
      return;
    }
    
    // Mode pouvoir de la Dame: cliquer une carte ADVERSE pour la voir 3s
    if (isQueenPowerActive) {
      // CORRECTION FINALE: La Dame permet de voir une carte ADVERSE
      // Dans l'interface, le joueur est TOUJOURS en bas (bottom) et l'adversaire en haut (top)
      // Donc avec le pouvoir de la Dame, on doit pouvoir cliquer sur les cartes du HAUT (top)
      
      // Avec le pouvoir de la Dame, on ne peut cliquer que sur les cartes adverses (top)
      if (player !== 'top') {
        console.log('ðŸ’« Dame: Vous ne pouvez voir que les cartes ADVERSES (en haut)');
        return;
      }
      
      console.log('ðŸ’« Dame: Tentative de voir une carte adverse sur le cÃ´tÃ©', player);
      const targetCards = player === 'top' ? player1Cards : player2Cards;
      if (targetCards[index].value === -1) return;
      
      // Activer le blocage global des clics
      setQueenCardSelected(true);
      
      console.log('ðŸ’« Dame: Carte sÃ©lectionnÃ©e, blocage des autres clics');

      // Retourner face visible 3 secondes (sans changer la logique du tour)
      if (player === 'top') {
        setPlayer1Cards(prev => {
          const next = [...prev];
          next[index] = { ...next[index], isFlipped: true };
          return next;
        });
      } else {
        setPlayer2Cards(prev => {
          const next = [...prev];
          next[index] = { ...next[index], isFlipped: true };
          return next;
        });
      }

      // Attendre 3s puis rebasculer face cachÃ©e
      await new Promise(resolve => setTimeout(resolve, 3000));
      if (player === 'top') {
        setPlayer1Cards(prev => {
          const next = [...prev];
          next[index] = { ...next[index], isFlipped: false };
          return next;
        });
      } else {
        setPlayer2Cards(prev => {
          const next = [...prev];
          next[index] = { ...next[index], isFlipped: false };
          return next;
        });
      }

      // DÃ©fausser la Dame piochÃ©e avec animation deck -> dÃ©fausse
      if (drawnCard) {
        const deckRect = deckRef.current?.getBoundingClientRect();
        const discardRect = discardRef.current?.getBoundingClientRect();
        if (deckRect && discardRect) {
          const deckCenter = { x: deckRect.left + deckRect.width / 2, y: deckRect.top + deckRect.height / 2 };
          const discardCenter = { x: discardRect.left + discardRect.width / 2, y: discardRect.top + discardRect.height / 2 };
          setReplaceOutImage(getCardImage(drawnCard.value));
          setReplaceOutAnim({ from: deckCenter, to: discardCenter, toPlayer: currentPlayer === 'player1' ? 'top' : 'bottom', index: -1, cardValue: drawnCard.value });
          await new Promise(resolve => setTimeout(resolve, 1000));
          setReplaceOutAnim(null);
          setReplaceOutImage(null);
        }
        setDiscardPile(drawnCard.value);
      }

      // Reset Ã©tats et fin de tour
      setIsQueenPowerActive(false);
      setDrawnCard(null);
      setShowCardActions(false);
      
      // RÃ©initialiser le blocage global aprÃ¨s un dÃ©lai
      setTimeout(() => {
        setQueenCardSelected(false);
        console.log('ðŸ’« Dame: DÃ©blocage des clics aprÃ¨s fin du pouvoir');
      }, 2000);
      
      // Notifier le serveur que le pouvoir est terminÃ©
      if (socket) {
        socket.emit('game:power_completed', {
          tableId: tableData?.tableId,
          userId: tableData?.currentUserId,
          powerType: 'queen'
        });
        
        // DÃ©fausser la Dame
        if (drawnCard) {
          socket.emit('game:discard_card', {
            tableId: tableData?.tableId,
            userId: tableData?.currentUserId,
            cardIndex: -1, // -1 = carte piochÃ©e (pas encore dans la main)
            card: drawnCard.value
          });
        }
      }
      return;
    }

    // Mode pouvoir du Valet: cliquer UNE SEULE carte PERSONNELLE pour la voir 3s
    if (isJackPowerActive) {
      // VÃ©rifier si le pouvoir a dÃ©jÃ  Ã©tÃ© utilisÃ© (bloque immÃ©diatement les clics multiples)
      if (jackPowerUsedRef.current) {
        console.log(' Valet: Pouvoir dÃ©jÃ  utilisÃ©, clic ignorÃ©');
        return;
      }
      
      // Ne permettre de cliquer que sur nos propres cartes (bottom)
      if (player !== 'bottom') return;
      
      // VÃ©rifier que la carte existe et n'est pas vide
      if (player2Cards[index].value === -1) return;
      
      // Marquer le pouvoir comme utilisÃ© IMMEÃ‰DIATEMENT pour bloquer tout autre clic
      jackPowerUsedRef.current = true;
      
      // Activer le blocage global des clics
      setJackCardSelected(true);
      
      // DÃ©sactiver l'Ã©tat du pouvoir (pour l'UI)
      setIsJackPowerActive(false);
      
      console.log(' Valet: Affichage de la carte sÃ©lectionnÃ©e pendant 3 secondes');
      
      // Retourner face visible 3 secondes
      setPlayer2Cards(prev => {
        const next = [...prev];
        next[index] = { ...next[index], isFlipped: true };
        return next;
      });
      
      // Attendre 3s puis rebasculer face cachÃ©e
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log(' Valet: Masquage de la carte aprÃ¨s 3 secondes');
      
      // Remettre face cachÃ©e
      setPlayer2Cards(prev => {
        const next = [...prev];
        next[index] = { ...next[index], isFlipped: false };
        return next;
      });

      console.log(' Valet: DÃ©fausse du Valet');
      
      // DÃ©fausser le Valet
      if (drawnCard) {
        // Animation de dÃ©fausse
        const deckRect = deckRef.current?.getBoundingClientRect();
        const discardRect = discardRef.current?.getBoundingClientRect();
        if (deckRect && discardRect) {
          const deckCenter = { x: deckRect.left + deckRect.width / 2, y: deckRect.top + deckRect.height / 2 };
          const discardCenter = { x: discardRect.left + discardRect.width / 2, y: discardRect.top + discardRect.height / 2 };
          setReplaceOutImage(getCardImage(drawnCard.value));
          setReplaceOutAnim({ from: deckCenter, to: discardCenter, toPlayer: currentPlayer === 'player1' ? 'top' : 'bottom', index: -1, cardValue: drawnCard.value });
          await new Promise(resolve => setTimeout(resolve, 1000));
          setReplaceOutAnim(null);
          setReplaceOutImage(null);
        }
        setDiscardPile(drawnCard.value);
        
        // Notifier le serveur
        if (socket) {
          console.log(' Valet: Notification au serveur');
          socket.emit('game:power_completed', {
            tableId: tableData?.tableId,
            userId: tableData?.currentUserId,
            powerType: 'jack'
          });
          
          socket.emit('game:discard_card', {
            tableId: tableData?.tableId,
            userId: tableData?.currentUserId,
            cardIndex: -1,
            card: drawnCard.value
          });
        }
      }
      
      // Reset Ã©tats
      setDrawnCard(null);
      setShowCardActions(false);
      
      // RÃ©initialiser la rÃ©fÃ©rence et le blocage global pour le prochain tour
      setTimeout(() => {
        jackPowerUsedRef.current = false;
        setJackCardSelected(false);
        console.log(' Valet: RÃ©initialisation des blocages pour le prochain tour');
      }, 2000);
      return;
    }

    // Si on est en train de sÃ©lectionner une carte Ã  remplacer, ce mode a la prioritÃ©
    if (selectingCardToReplace) {
      // VÃ©rifier si le joueur actuel est bien celui qui doit jouer
      // Prendre en compte amIPlayer1 pour dÃ©terminer correctement le joueur actuel
      let isCurrentPlayer;
      if (amIPlayer1) {
        // Je suis player1, mes cartes sont en bas (bottom)
        isCurrentPlayer = (player === 'bottom' && currentPlayer === 'player1');
      } else {
        // Je suis player2, mes cartes sont en bas (bottom)
        isCurrentPlayer = (player === 'bottom' && currentPlayer === 'player2');
      }
      
      if (isCurrentPlayer && drawnCard) {
        // RÃ©cupÃ©rer les rectangles pour les animations
        const oldCard = playerCards[index];
        const oldCardId = oldCard.id;
        // Chercher d'abord par id, sinon fallback par index
        let selEl = document.querySelector(`[data-player="${player}"][data-card-id="${oldCardId}"]`) as HTMLElement | null;
        if (!selEl) {
          selEl = document.querySelector(`[data-player="${player}"][data-card-index="${index}"]`) as HTMLElement | null;
        }
        const deckRect = deckRef.current?.getBoundingClientRect();
        const discardRect = discardRef.current?.getBoundingClientRect();

        if (selEl && deckRect && discardRect) {
          // Masquer la carte source pendant l'animation sortante
          selEl.style.visibility = 'hidden';
          const selRect = selEl.getBoundingClientRect();
          const selCenter = { x: selRect.left + selRect.width / 2, y: selRect.top + selRect.height / 2 };
          const deckCenter = { x: deckRect.left + deckRect.width / 2, y: deckRect.top + deckRect.height / 2 };
          const discardCenter = { x: discardRect.left + discardRect.width / 2, y: discardRect.top + discardRect.height / 2 };

          // Animation 1: la carte sÃ©lectionnÃ©e vers la dÃ©fausse (1s)
          const oldCardValue = oldCard.value;
          setReplaceOutImage(getCardImage(oldCardValue));
          setReplaceOutAnim({ from: selCenter, to: discardCenter, toPlayer: player, index, cardValue: oldCardValue });
          await new Promise(resolve => setTimeout(resolve, 1000));
          setReplaceOutAnim(null);
          setReplaceOutImage(null);
          if (oldCardValue !== -1) setDiscardPile(oldCardValue);

          // Animation 2: la carte piochÃ©e depuis le deck vers l'emplacement sÃ©lectionnÃ© (1s)
          setReplaceInImage(getCardImage(drawnCard.value));
          setReplaceInAnim({ from: deckCenter, to: selCenter, toPlayer: player, index, cardValue: drawnCard.value });
          await new Promise(resolve => setTimeout(resolve, 1000));
          setReplaceInAnim(null);
          setReplaceInImage(null);
        }

        // Utiliser updateCardArray pour mettre Ã  jour les cartes de maniÃ¨re cohÃ©rente
        const updatedCards = [...playerCards];
        
        // S'assurer que le tableau a la bonne taille
        while (updatedCards.length <= index) {
          updatedCards.push({
            id: `card-filler-${Date.now()}-${Math.random()}`,
            value: -1,
            isFlipped: false
          });
        }
        
        // Mettre Ã  jour la carte Ã  l'index spÃ©cifiÃ©
        updatedCards[index] = {
          id: `replaced-${Date.now()}-${Math.random()}`,
          value: drawnCard.value,
          isFlipped: false
        };
        
        console.log(`âœ… Updated my cards with replacement. Now has ${updatedCards.length} cards with updated card at index ${index}`);
        
        if (player === 'top') {
          setPlayer1Cards(updatedCards);
        } else {
          setPlayer2Cards(updatedCards);
        }

        // RÃ©initialiser les Ã©tats
        setDrawnCard(null);
        setShowCardActions(false);
        setSelectingCardToReplace(false);

        // Ã‰mettre l'Ã©vÃ©nement de remplacement de carte au serveur
        if (socket) {
          socket.emit('game:replace_card', {
            tableId: tableData?.tableId,
            userId: tableData?.currentUserId,
            cardIndex: index,
            newCard: {
              id: `drawn-${Date.now()}`,
              value: drawnCard.value,
              isFlipped: false,
              isVisible: false,
              position: index
            }
          });
        }
        
        // Ne pas appeler handleTurnEnd ici, le serveur gÃ©rera le changement de tour

        // AprÃ¨s le re-render, rÃ©afficher le slot
        try {
          await new Promise(requestAnimationFrame);
          const selEl2 = document.querySelector(`[data-player="${player}"][data-card-index="${index}"]`) as HTMLElement | null;
          if (selEl2) selEl2.style.visibility = '';
        } catch {}
      }
      return;
    }

    // VÃ©rifier si on est en mode dÃ©fausse rapide (aprÃ¨s la phase de mÃ©morisation)
    // IMPORTANT: On ne peut dÃ©fausser QUE ses propres cartes (bottom)
    if (player === 'bottom' && gamePhase !== 'preparation' && gamePhase !== 'before_round' && discardPile !== null && !drawnCard && !selectingCardToReplace && quickDiscardActive) {
      // Retourner la carte cliquÃ©e face visible
      setPlayer2Cards(prev => {
        const newCards = [...prev];
        newCards[index] = { ...newCards[index], isFlipped: true };
        return newCards;
      });
      
      // Petite pause pour montrer la carte
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const topRaw = discardPile;
      const clickedRaw = playerCards[index].value;
      const topCardValue = getCardValue(topRaw);
      const clickedCardValue = getCardValue(clickedRaw);

      // Correspondance: si les deux sont des Jokers, il faut mÃªme type (joker vs joker2)
      // Sinon, comparer les valeurs de rang.
      const isMatch = (() => {
        if (isJoker(topRaw) && isJoker(clickedRaw)) {
          const topType = topRaw >= 110 ? 2 : 1; // 110..115 => joker2
          const clickedType = clickedRaw >= 110 ? 2 : 1;
          return topType === clickedType;
        }
        if (isJoker(topRaw) || isJoker(clickedRaw)) return false;
        return clickedCardValue === topCardValue;
      })();

      // VÃ©rifier si la carte cliquÃ©e correspond Ã  la valeur/type de la dÃ©fausse
      if (isMatch) {
        console.log('âœ… Quick discard match! Emitting to server...');
        // Ã‰mettre au serveur pour dÃ©fausse rapide
        if (socket) {
          socket.emit('game:quick_discard', {
            tableId: tableData?.tableId,
            userId: myPlayerInfo?.userId,
            cardIndex: index,
            card: clickedRaw
          });
        }
        return;
      } else {
        console.log('âŒ Quick discard mismatch! Emitting penalty to server...');
        // Ã‰mettre au serveur pour pÃ©nalitÃ©
        if (socket) {
          socket.emit('game:quick_discard_penalty', {
            tableId: tableData?.tableId,
            userId: myPlayerInfo?.userId,
            cardIndex: index
          });
        }
        return;
      }
    }
    
    // En phase d'avant tour, on laisse chaque joueur retourner 2 cartes
    if (gamePhase === 'before_round') {
      const playerKey = player === 'top' ? 'player1' : 'player2';
      const playerCards = player === 'top' ? player1Cards : player2Cards;
      
      // VÃ©rifier si la carte est dÃ©jÃ  retournÃ©e
      if (playerCards[index].isFlipped) return;
      
      // VÃ©rifier si le joueur a dÃ©jÃ  retournÃ© 2 cartes
      if (cardsFlipped[playerKey].count >= 2) return;
      
      // Retourner la carte
      const newCards = [...playerCards];
      newCards[index] = { ...newCards[index], isFlipped: true };
      
      if (player === 'top') {
        setPlayer1Cards(newCards);
      } else {
        setPlayer2Cards(newCards);
      }
      
      // Mettre Ã  jour le compteur de cartes retournÃ©es et vÃ©rifier si on doit dÃ©marrer le minuteur
      setCardsFlipped(prev => {
        const updated = {
          ...prev,
          [playerKey]: {
            count: prev[playerKey].count + 1,
            indexes: [...prev[playerKey].indexes, index]
          }
        };
        
        return updated;
      });
      
      return;
    }
    
    // AprÃ¨s la phase 'before_round', les cartes ne peuvent plus Ãªtre retournÃ©es
    if (gamePhase === 'player1_turn' || gamePhase === 'player2_turn') {
      console.log('La phase de retournement des cartes est terminÃ©e');
      return;
    }
    
    console.log('Tentative de retournement - Phase:', gamePhase, 'Joueur actuel:', currentPlayer, 'Clic sur:', player);
    
    // VÃ©rifier si c'est bien le tour du joueur qui clique
    const isPlayer1Turn = currentPlayer === 'player1';
    const isCorrectPlayer = (player === 'top' && isPlayer1Turn) || (player === 'bottom' && !isPlayer1Turn);
    
    if (!isCorrectPlayer) {
      console.log('Ce n\'est pas votre tour!');
      return;
    }

    // Retourner la carte du joueur concernÃ©
    const updateCards = (prevCards: CardState[]) => {
      // Ne pas retourner si la carte est dÃ©jÃ  face visible ou n'existe pas
      if (prevCards[index].isFlipped || prevCards[index].value === -1) {
        return prevCards;
      }
      
      console.log('Retournement de la carte', index, 'du joueur', player);
      const newCards = [...prevCards];
      newCards[index] = { 
        ...newCards[index],
        isFlipped: true 
      };
      return newCards;
    };

    if (player === 'top') {
      setPlayer1Cards(updateCards);
    } else {
      setPlayer2Cards(updateCards);
    }
  };


  return { handleDeclareBombomFor, handleCancelBombom, handleCardClick };
}
