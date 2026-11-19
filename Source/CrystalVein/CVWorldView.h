#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CVSimLink.h"
#include "CVWorldView.generated.h"

class UDirectionalLightComponent;
class UInstancedStaticMeshComponent;
class UPointLightComponent;
class USkeletalMeshComponent;

/** A small light that is not a lamp: a fire, creep, a screen. */
struct FCVGlow
{
	FVector Pos = FVector::ZeroVector;
	FLinearColor Color = FLinearColor::White;
	float Candelas = 0.f;
	float Radius = 300.f;
};

/**
 * Draws the deck the sim describes, as greybox: basic shapes, one instanced mesh per kind of piece, real lights.
 * It holds no game rules. 1 tile = 100 cm; sim x, y map to world X, Y.
 * Engine basic shapes and engine materials stand in for the art. Kit.txt in the project folder puts bought assets in their place or
 * on top of them, piece by piece, without a build (LoadKit).
 * shortcut: a kit mesh is fitted into the grey box of its piece; walls and floors from a modular kit need a placing rule of their own.
 */
UCLASS()
class ACVWorldView : public AActor
{
	GENERATED_BODY()

public:
	ACVWorldView();

	/** a new level arrived (start, restart) */
	void Build(const FCVLevel& Level);
	/** tiles changed: doors, creep, things burned or broken. Only the kinds whose tiles differ are rebuilt. */
	void RefreshTiles(const FCVLevel& Level);
	/** everything that moves, burns or toggles, once per frame */
	void Apply(const FCVLevel& Level, const FCVSnap& Snap);
	/** the generator caught: the lamps come on one after the other */
	void PowerUp();
	/** the fill turned up until the whole deck shows, for the overview picture; off puts FillLux back */
	void SetSurveyLight(bool bOn);

	/** cm per sim px */
	float GetUnitsPerPx() const { return UnitsPerPx; }

	/** Emergency lamps and the battery lamp, in candelas. Dim on purpose: you see by them once your eyes have adapted. */
	UPROPERTY(EditAnywhere, Category = "Light")
	float LampCandelas = 60.f;

	UPROPERTY(EditAnywhere, Category = "Light")
	bool bLampShadows = true;

	UPROPERTY(EditAnywhere, Category = "Light")
	float FireCandelas = 18.f;

	/**
	 * A cold light straight down on everything, without shadows, in lux: the deck as a faint plan where no lamp reaches.
	 * Beam on it is close to black; with adapted eyes you can find the doors by it.
	 */
	UPROPERTY(EditAnywhere, Category = "Light")
	float FillLux = 0.25f; // 1.6 until 18 Nov: then the deck showed as a plan and the flashlight was a convenience (Leon: lean into it)

	/** per creep tile in a cluster; red is alien and nothing else */
	UPROPERTY(EditAnywhere, Category = "Light")
	float CreepCandelas = 2.2f;

	UPROPERTY(EditAnywhere, Category = "Light")
	float ScreenCandelas = 8.f;

	/** A thrown flare. It burns white, not red: red is alien. Low over the floor, so everything near it throws a long shadow. */
	UPROPERTY(EditAnywhere, Category = "Light")
	float FlareCandelas = 300.f;

private:
	void EnsureMeshes();
	void LoadKit();
	void Show(int32 Kind, const TArray<FTransform>& Transforms);
	UPointLightComponent* LightAt(TArray<TObjectPtr<UPointLightComponent>>& Pool, int32 Index, bool bShadows);
	FVector TileCentre(const FCVLevel& Level, int32 TileIndex, double Z) const;

	/** one per kind of piece, then one per prop line of Kit.txt (none where the line says none) */
	UPROPERTY()
	TArray<TObjectPtr<UInstancedStaticMeshComponent>> Meshes;

	UPROPERTY()
	TArray<TObjectPtr<UPointLightComponent>> Lamps;

	UPROPERTY()
	TArray<TObjectPtr<UPointLightComponent>> Glows;

	UPROPERTY()
	TObjectPtr<UDirectionalLightComponent> Fill;

	UPROPERTY()
	TArray<TObjectPtr<UPointLightComponent>> FlareLamps;

	/** aliens whose type has an animated body in Kit.txt, by the sim's id */
	UPROPERTY()
	TMap<int32, TObjectPtr<USkeletalMeshComponent>> Bodies;

	/** what Kit.txt loaded, held here so that it stays loaded */
	UPROPERTY()
	TArray<TObjectPtr<UObject>> KitAssets;

	/** in step with Kit.txt's lines: for a growth line, a second mesh for the tiles growth is still moving into (redrawn every frame) */
	UPROPERTY()
	TArray<TObjectPtr<UInstancedStaticMeshComponent>> GrowingMeshes;

	/** tile to the tick it turned to growth, and, in step with CreepGlows, the tick each cluster's oldest tile did */
	TMap<int32, int32> CreepBorn;
	TArray<int32> CreepGlowBorn;
	int32 LastTick = 0;

	TArray<uint32> ShownHash;
	TArray<bool> LampAlways;
	TArray<float> LampOnAt;
	TArray<FCVGlow> CreepGlows;
	TArray<FCVThing> Things;
	float UnitsPerPx = 6.25f;
	float PowerAt = -1.f;
};
