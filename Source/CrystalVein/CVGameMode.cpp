#include "CVGameMode.h"
#include "CVPawn.h"
#include "CVPlayerController.h"

ACVGameMode::ACVGameMode()
{
	DefaultPawnClass = ACVPawn::StaticClass();
	PlayerControllerClass = ACVPlayerController::StaticClass();
}
