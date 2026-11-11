#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "CVSimLink.h"
#include "CVPlayerController.generated.h"

class ACVWorldView;
class SCVHud;

/**
 * The seam between Unreal and the sim, once per frame: read what the sim sent, show it (world, pawn, HUD), send the player's input back.
 * shortcut: keys and sticks are polled here with fixed bindings. Replace with Enhanced Input actions and a mapping context
 * (rebinding, Steam Input glyphs) once the editor can be driven from the build tools: those are assets, not code.
 */
UCLASS()
class ACVPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	ACVPlayerController();

	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	virtual void PlayerTick(float DeltaTime) override;

private:
	enum class EPanel : uint8 { None, Note, Dead, Done };

	void OpenPanel(EPanel Kind, const FString& Title, const FString& Body);
	bool PressedAny(std::initializer_list<FKey> Keys) const;
	bool HeldAny(std::initializer_list<FKey> Keys) const;
	/** a direction on the screen (x right, y up) as a direction on the deck, in the sim's axes */
	FVector2D ScreenToDeck(const FVector2D& OnScreen) const;

	FCVSimLink Link;

	UPROPERTY()
	TObjectPtr<ACVWorldView> WorldView;

	TSharedPtr<SCVHud> Hud;
	EPanel Panel = EPanel::None;
	FVector2D AimDir = FVector2D(1.0, 0.0);
	FVector2D LastMouse = FVector2D::ZeroVector;
	FString Whisper;
	float WhisperUntil = 0.f;
	float HintUntil = 0.f;
	bool bUsingPad = false;
	bool bSnapNext = true;
	float NextShotAt = 0.f;
	float SmoothedFps = 0.f;
	int32 ShotIndex = 0;

public:
	/** Seconds between the screenshots written to Saved/DevLoop while playing (the last 24 are kept; not in shipping builds). 0 turns them off. */
	UPROPERTY(EditAnywhere, Category = "Development")
	float ShotEvery = 5.f;
};
