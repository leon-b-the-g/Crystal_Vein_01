#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "CVPawn.generated.h"

class UCameraComponent;
class UPointLightComponent;
class USpotLightComponent;
class USpringArmComponent;
class UStaticMeshComponent;
struct FCVSnap;

/**
 * The player as Unreal shows him: a greybox body, the flashlight, and the fixed isometric camera.
 * He does not move himself. The sim says where he is; ShowSnap puts him there.
 */
UCLASS()
class ACVPawn : public APawn
{
	GENERATED_BODY()

public:
	ACVPawn();

	/** puts the body, the beam and the camera where this snapshot says. bSnapTo: no easing (first frame, restart). */
	void ShowSnap(const FCVSnap& Snap, float UnitsPerPx, float DeltaTime, bool bSnapTo);

	/** after ShowSnap: the camera goes straight above the whole deck, north up, and his own lights go out. The demo run's first picture. */
	void ShowOverview(const FVector& Centre, float Distance);

	/** the way the camera looks, in degrees; the controller turns "up on the screen" into a direction on the deck with it */
	UPROPERTY(EditAnywhere, Category = "Camera")
	float CameraYaw = -45.f;

	UPROPERTY(EditAnywhere, Category = "Camera")
	float CameraPitch = -58.f;

	/** With the 30 degree lens this shows about 22 m of deck across, as the web build does. */
	UPROPERTY(EditAnywhere, Category = "Camera")
	float CameraDistance = 4100.f;

	/** The flashlight, in candelas. At ExposureLit, 350 puts a wall four metres off just under half of white; a lamp-lit wall sits near a fifth. */
	UPROPERTY(EditAnywhere, Category = "Light")
	float FlashlightCandelas = 350.f;

	/** what you can make out right around you, light on or off (the web build's "peripheral" radius): about three metres of floor */
	UPROPERTY(EditAnywhere, Category = "Light")
	float SpillCandelas = 10.f;

	/**
	 * Dark adaptation, in stops (EV100; one stop down doubles the picture). The beam on: ExposureLit, reached in under a second.
	 * The beam off or dead: ExposureDark, reached over about three seconds; then the fill and the lamps carry the picture.
	 */
	UPROPERTY(EditAnywhere, Category = "Light")
	float ExposureLit = 1.f;

	UPROPERTY(EditAnywhere, Category = "Light")
	float ExposureDark = -0.5f;

	/** how fast the shown body catches up with the sim (the sim ticks 60 times a second; frames do not line up with it) */
	UPROPERTY(EditAnywhere, Category = "Camera")
	float FollowSpeed = 24.f;

private:
	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<UStaticMeshComponent> Body;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<UStaticMeshComponent> Tool;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<USpotLightComponent> Flashlight;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<UPointLightComponent> Spill;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<USpringArmComponent> Boom;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<UCameraComponent> Camera;

	float Stop = 1.f; // the exposure now, EV100
};
