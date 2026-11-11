#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "CVGameMode.generated.h"

/** Puts the player's pawn and controller in place. The game itself is the sim's. */
UCLASS()
class ACVGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ACVGameMode();
};
