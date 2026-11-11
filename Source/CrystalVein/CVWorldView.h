#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CVSimLink.h"
#include "CVWorldView.generated.h"

class UDirectionalLightComponent;
class UInstancedStaticMeshComponent;
class UPointLightComponent;

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
 * shortcut: engine basic shapes and engine materials stand in for the art; each kind in CVWorldView.cpp's table is one mesh to replace.
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
	float FillLux = 1.6f;

	/** per creep tile in a cluster; red is alien and nothing else */
	UPROPERTY(EditAnywhere, Category = "Light")
	float CreepCandelas = 1.5f;

	UPROPERTY(EditAnywhere, Category = "Light")
	float ScreenCandelas = 8.f;

private:
	void EnsureMeshes();
	void Show(int32 Kind, const TArray<FTransform>& Transforms);
	UPointLightComponent* LightAt(TArray<TObjectPtr<UPointLightComponent>>& Pool, int32 Index, bool bShadows);
	FVector TileCentre(const FCVLevel& Level, int32 TileIndex, double Z) const;

	UPROPERTY()
	TArray<TObjectPtr<UInstancedStaticMeshComponent>> Meshes;

	UPROPERTY()
	TArray<TObjectPtr<UPointLightComponent>> Lamps;

	UPROPERTY()
	TArray<TObjectPtr<UPointLightComponent>> Glows;

	UPROPERTY()
	TObjectPtr<UDirectionalLightComponent> Fill;

	TArray<uint32> ShownHash;
	TArray<bool> LampAlways;
	TArray<float> LampOnAt;
	TArray<FCVGlow> CreepGlows;
	TArray<FCVThing> Things;
	float UnitsPerPx = 6.25f;
	float PowerAt = -1.f;
};
