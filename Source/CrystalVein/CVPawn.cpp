#include "CVPawn.h"
#include "CVSimLink.h"
#include "Camera/CameraComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SceneComponent.h"
#include "Components/SpotLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "GameFramework/SpringArmComponent.h"
#include "UObject/ConstructorHelpers.h"

ACVPawn::ACVPawn()
{
	PrimaryActorTick.bCanEverTick = false; // the controller shows each snapshot
	SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("Root")));

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderMesh(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));

	Body = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Body"));
	Body->SetupAttachment(RootComponent);
	Body->SetStaticMesh(CylinderMesh.Object);
	Body->SetRelativeScale3D(FVector(0.5, 0.5, 1.7));
	Body->SetRelativeLocation(FVector(0.0, 0.0, 85.0));
	Body->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	// whatever is in hand: a bar held out in front, swung down when the sim says so
	Tool = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Tool"));
	Tool->SetupAttachment(RootComponent);
	Tool->SetStaticMesh(CubeMesh.Object);
	Tool->SetRelativeScale3D(FVector(0.5, 0.06, 0.06));
	Tool->SetRelativeLocation(FVector(45.0, 22.0, 110.0));
	Tool->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Tool->SetCastShadow(false); // it sits beside the lens

	// the sim's beam: 66 degrees wide, soft over its outer third, about eight metres
	Flashlight = CreateDefaultSubobject<USpotLightComponent>(TEXT("Flashlight"));
	Flashlight->SetupAttachment(RootComponent);
	Flashlight->SetRelativeLocation(FVector(28.0, -14.0, 128.0));
	Flashlight->SetRelativeRotation(FRotator(-7.0, 0.0, 0.0));
	Flashlight->IntensityUnits = ELightUnits::Candelas;
	Flashlight->Intensity = 0.f;
	Flashlight->OuterConeAngle = 33.f;
	Flashlight->InnerConeAngle = 21.f;
	Flashlight->AttenuationRadius = 950.f;
	Flashlight->SourceRadius = 2.f;
	Flashlight->LightColor = FColor(232, 240, 255);
	Flashlight->CastShadows = true;

	Spill = CreateDefaultSubobject<UPointLightComponent>(TEXT("Spill"));
	Spill->SetupAttachment(RootComponent);
	Spill->SetRelativeLocation(FVector(0.0, 0.0, 170.0));
	Spill->IntensityUnits = ELightUnits::Candelas;
	Spill->Intensity = 0.f;
	Spill->AttenuationRadius = 260.f;
	Spill->LightColor = FColor(200, 215, 255);
	Spill->CastShadows = false;

	// the camera keeps its own heading while the body turns to aim
	Boom = CreateDefaultSubobject<USpringArmComponent>(TEXT("Boom"));
	Boom->SetupAttachment(RootComponent);
	Boom->SetUsingAbsoluteRotation(true);
	Boom->SetRelativeRotation(FRotator(CameraPitch, CameraYaw, 0.0));
	Boom->TargetArmLength = CameraDistance;
	Boom->bDoCollisionTest = false;

	// a long lens from far off reads as isometric and keeps walls from leaning
	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(Boom);
	Camera->SetFieldOfView(30.f);

	// Dark adaptation: exposure follows the brightest tenth of the picture, quickly up when a light comes on, slowly down in
	// the dark, between two stops (EV100). Light off: after a few seconds you see by the amber lamps. Light on: they fall back to black.
	FPostProcessSettings& Look = Camera->PostProcessSettings;
	Look.bOverride_AutoExposureMethod = true;
	Look.AutoExposureMethod = AEM_Histogram;
	Look.bOverride_AutoExposureMinBrightness = true;
	Look.AutoExposureMinBrightness = -1.5f;
	Look.bOverride_AutoExposureMaxBrightness = true;
	Look.AutoExposureMaxBrightness = 3.5f;
	Look.bOverride_AutoExposureSpeedUp = true;
	Look.AutoExposureSpeedUp = 3.f;
	Look.bOverride_AutoExposureSpeedDown = true;
	Look.AutoExposureSpeedDown = 0.6f;
	Look.bOverride_AutoExposureLowPercent = true;
	Look.AutoExposureLowPercent = 88.f;
	Look.bOverride_AutoExposureHighPercent = true;
	Look.AutoExposureHighPercent = 98.f;
	Look.bOverride_VignetteIntensity = true;
	Look.VignetteIntensity = 0.55f;
	Look.bOverride_FilmGrainIntensity = true;
	Look.FilmGrainIntensity = 0.2f;
}

void ACVPawn::ShowSnap(const FCVSnap& Snap, float UnitsPerPx, float DeltaTime, bool bSnapTo)
{
	const FVector Target(Snap.Pos.X * UnitsPerPx, Snap.Pos.Y * UnitsPerPx, 0.0);
	const FRotator Facing(0.0, FMath::RadiansToDegrees(Snap.Aim), 0.0);
	SetActorLocationAndRotation(
		bSnapTo ? Target : FMath::VInterpTo(GetActorLocation(), Target, DeltaTime, FollowSpeed),
		bSnapTo ? Facing : FMath::RInterpTo(GetActorRotation(), Facing, DeltaTime, FollowSpeed));
	Boom->SetRelativeRotation(FRotator(CameraPitch, CameraYaw, 0.0));
	Boom->TargetArmLength = CameraDistance;

	const bool bAlive = Snap.Has(ECVFlag::Alive);
	const bool bInLocker = Snap.Has(ECVFlag::Hidden);
	const double Height = !bAlive ? 0.3 : Snap.Has(ECVFlag::Crouching) ? 1.15 : 1.7; // down, crouched, standing
	Body->SetVisibility(!bInLocker);
	Body->SetRelativeScale3D(FVector(0.5, 0.5, Height));
	Body->SetRelativeLocation(FVector(0.0, 0.0, Height * 50.0));
	Tool->SetVisibility(bAlive && !bInLocker && !Snap.Weapon.IsEmpty());
	Tool->SetRelativeRotation(FRotator(Snap.Has(ECVFlag::Swinging) ? -65.0 : 20.0, 0.0, 0.0));

	// the sim owns the beam: on or off, its flicker, the moment it dies
	Flashlight->SetIntensity(bAlive && !bInLocker && Snap.bLightOn ? FlashlightCandelas * FMath::Clamp(Snap.LightIntensity, 0.f, 1.f) : 0.f);
	Spill->SetIntensity(bAlive ? SpillCandelas : 0.f);
}
