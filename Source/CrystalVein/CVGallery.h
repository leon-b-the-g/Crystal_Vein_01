#pragma once

#include "CoreMinimal.h"
#include "AssetRegistry/AssetData.h"
#include "GameFramework/Actor.h"
#include "CVGallery.generated.h"

class UCameraComponent;
class UStaticMeshComponent;

/**
 * A look at bought assets without the editor: every static and skeletal mesh under a content folder, five to a page, each standing
 * on a floor with its name and real size, photographed to Saved/DevLoop/gallery_NN.png with a log line per mesh. Then the game quits.
 * It runs in place of the game when Saved/DevLoop/gallery.txt exists (CVPlayerController::BeginPlay).
 * shortcut: one fixed view and the reference pose; a turntable or a pose from an animation when one view is not enough.
 */
UCLASS()
class ACVGallery : public AActor
{
	GENERATED_BODY()

public:
	ACVGallery();

	/** every mesh under this content folder; nothing means /Game, all of them */
	void Start(const FString& Folder);
	virtual void Tick(float DeltaTime) override;

private:
	void ShowPage();

	UPROPERTY()
	TObjectPtr<UCameraComponent> Camera;

	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> Ground;

	UPROPERTY()
	TArray<TObjectPtr<USceneComponent>> Shown;

	TArray<FAssetData> Assets;
	int32 Page = -1;
	float ShootAt = -1.f;
	float NextAt = 0.f;
};
