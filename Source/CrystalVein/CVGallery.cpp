#include "CVGallery.h"
#include "CrystalVein.h"
#include "Animation/AnimSequence.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Camera/CameraComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Misc/Paths.h"
#include "ShaderCompiler.h"
#include "UObject/ConstructorHelpers.h"
#include "UnrealClient.h"

namespace
{
	const int32 GalleryPerPage = 5;
	const double GalleryCellCm = 215.0; // from one mesh to the next
	const double GalleryFitCm = 170.0;  // the longest side of every mesh is shown this long; its label gives the real size
}

ACVGallery::ACVGallery()
{
	PrimaryActorTick.bCanEverTick = true;
	SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("Root")));

	// The camera looks along +X and down: +Y is right in the picture, +X is away. A mesh modelled facing +X shows its back.
	const FRotator Look(-32.0, 0.0, 0.0);
	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(RootComponent);
	Camera->SetFieldOfView(40.f);
	Camera->SetRelativeLocationAndRotation(FVector(0.0, 0.0, 70.0) - Look.Vector() * 1750.0, Look);
	// exposure by hand, as the pawn's camera: a surface of luminance L cd/m2 lands at L / 1.2 of white
	FPostProcessSettings& Exposure = Camera->PostProcessSettings;
	Exposure.bOverride_AutoExposureMethod = true;
	Exposure.AutoExposureMethod = AEM_Manual;
	Exposure.bOverride_AutoExposureApplyPhysicalCameraExposure = true;
	Exposure.AutoExposureApplyPhysicalCameraExposure = false;
	Exposure.bOverride_AutoExposureBias = true;
	Exposure.AutoExposureBias = 0.f;

	// a key light over the camera's right shoulder and a weaker one from behind the meshes, in lux
	UDirectionalLightComponent* Key = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("Key"));
	Key->SetupAttachment(RootComponent);
	Key->SetRelativeRotation(FRotator(-48.0, 38.0, 0.0));
	Key->Intensity = 4.f;
	UDirectionalLightComponent* Soft = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("Soft"));
	Soft->SetupAttachment(RootComponent);
	Soft->SetRelativeRotation(FRotator(-30.0, -150.0, 0.0));
	Soft->Intensity = 1.5f;
	Soft->CastShadows = false;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));
	Ground = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Ground"));
	Ground->SetupAttachment(RootComponent);
	Ground->SetStaticMesh(CubeMesh.Object);
	Ground->SetRelativeScale3D(FVector(60.0, 60.0, 0.1));
	Ground->SetRelativeLocation(FVector(0.0, 0.0, -5.0));
	Ground->SetCollisionEnabled(ECollisionEnabled::NoCollision);
}

void ACVGallery::Start(const FString& Folder)
{
	if (UMaterialInstanceDynamic* Paint = Ground->CreateDynamicMaterialInstance(0))
	{
		Paint->SetVectorParameterValue(TEXT("Color"), FLinearColor(0.10f, 0.11f, 0.12f));
	}
	// a line each: a content folder, then, if wanted, parts of names (any of which will do)
	TArray<FString> Lines;
	Folder.ParseIntoArrayLines(Lines);
	if (Lines.Num() == 0)
	{
		Lines.Add(TEXT("/Game"));
	}
	IAssetRegistry& Registry = FModuleManager::LoadModuleChecked<FAssetRegistryModule>(TEXT("AssetRegistry")).Get();
	for (const FString& Line : Lines)
	{
		TArray<FString> Words;
		if (Line.ParseIntoArrayWS(Words) == 0)
		{
			continue;
		}
		Registry.ScanPathsSynchronous({ Words[0] }, true);
		FARFilter Wanted;
		Wanted.PackagePaths.Add(FName(*Words[0]));
		Wanted.bRecursivePaths = true;
		Wanted.ClassPaths.Add(UStaticMesh::StaticClass()->GetClassPathName());
		Wanted.ClassPaths.Add(USkeletalMesh::StaticClass()->GetClassPathName());
		Wanted.ClassPaths.Add(UAnimSequence::StaticClass()->GetClassPathName());
		TArray<FAssetData> Found;
		Registry.GetAssets(Wanted, Found);
		for (const FAssetData& Data : Found)
		{
			const FString Called = Data.AssetName.ToString();
			bool bNamed = Words.Num() == 1;
			for (int32 Index = 1; Index < Words.Num(); ++Index)
			{
				bNamed |= Called.Contains(Words[Index]);
			}
			if (Data.AssetClassPath == UAnimSequence::StaticClass()->GetClassPathName())
			{
				UE_LOG(LogCrystalVein, Log, TEXT("Gallery: animation %s"), *Data.GetObjectPathString());
			}
			else if (bNamed)
			{
				Assets.Add(Data);
			}
		}
	}
	Assets.Sort([](const FAssetData& A, const FAssetData& B) { return A.GetObjectPathString() < B.GetObjectPathString(); });
	UE_LOG(LogCrystalVein, Log, TEXT("Gallery: %d meshes, %d to a page"), Assets.Num(), GalleryPerPage);
}

void ACVGallery::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);
	const float Now = (float)GetWorld()->GetTimeSeconds();
	if (APlayerController* Viewer = GetWorld()->GetFirstPlayerController(); Viewer != nullptr && Viewer->GetViewTarget() != this)
	{
		Viewer->SetViewTarget(this);
		if (APawn* Figure = Viewer->GetPawn())
		{
			Figure->SetActorHiddenInGame(true); // the player's grey body stands at the origin
		}
	}
	if (ShootAt >= 0.f)
	{
		// a material seen for the first time is compiled while the default grey stands in for it: wait that out
		if (GShaderCompilingManager != nullptr && GShaderCompilingManager->IsCompiling())
		{
			ShootAt = Now + 1.f;
		}
		else if (Now >= ShootAt)
		{
			ShootAt = -1.f;
			NextAt = Now + 1.5f; // the file is written in the background
			const FString ShotPath = FPaths::ConvertRelativePathToFull(FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("DevLoop"), FString::Printf(TEXT("gallery_%02d.png"), Page)));
			FScreenshotRequest::RequestScreenshot(ShotPath, true, false, false, FIntRect(), true);
		}
	}
	else if (Now >= NextAt)
	{
		++Page;
		if (Page * GalleryPerPage >= Assets.Num())
		{
			UE_LOG(LogCrystalVein, Log, TEXT("Gallery ends: %d pages"), Page);
			SetActorTickEnabled(false);
			FPlatformMisc::RequestExit(false);
			return;
		}
		ShowPage();
		ShootAt = Now + 2.5f; // textures stream in, the picture settles
	}
}

void ACVGallery::ShowPage()
{
	for (USceneComponent* Old : Shown)
	{
		if (Old != nullptr)
		{
			Old->DestroyComponent();
		}
	}
	Shown.Reset();
	for (int32 Place = 0; Place < GalleryPerPage && Page * GalleryPerPage + Place < Assets.Num(); ++Place)
	{
		const FAssetData& Data = Assets[Page * GalleryPerPage + Place];
		UObject* Loaded = Data.GetAsset();
		UStaticMesh* Static = Cast<UStaticMesh>(Loaded);
		USkeletalMesh* Skeletal = Cast<USkeletalMesh>(Loaded);
		if (Static == nullptr && Skeletal == nullptr)
		{
			UE_LOG(LogCrystalVein, Warning, TEXT("Gallery: %s did not load"), *Data.GetObjectPathString());
			continue;
		}
		const FBox Box = Static != nullptr ? Static->GetBoundingBox() : Skeletal->GetBounds().GetBox();
		const FVector Size = Box.GetSize();
		const double Shrink = GalleryFitCm / FMath::Max(Size.GetMax(), 1.0);
		const FVector Stand(0.0, (Place - (GalleryPerPage - 1) * 0.5) * GalleryCellCm, 0.0);

		UMeshComponent* Model = nullptr;
		if (Static != nullptr)
		{
			UStaticMeshComponent* Solid = NewObject<UStaticMeshComponent>(this);
			Solid->SetStaticMesh(Static);
			Model = Solid;
		}
		else
		{
			USkeletalMeshComponent* Rigged = NewObject<USkeletalMeshComponent>(this);
			Rigged->SetSkeletalMeshAsset(Skeletal);
			Model = Rigged;
		}
		Model->bForceMipStreaming = true;
		Model->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		Model->SetupAttachment(GetRootComponent());
		Model->RegisterComponent();
		// the middle of its underside on its place, whatever its origin
		Model->SetWorldTransform(FTransform(FRotator::ZeroRotator, Stand - FVector(Box.GetCenter().X, Box.GetCenter().Y, Box.Min.Z) * Shrink, FVector(Shrink)));
		Shown.Add(Model);

		// upright, facing the camera, in front of its mesh
		UTextRenderComponent* Label = NewObject<UTextRenderComponent>(this);
		Label->SetText(FText::FromString(FString::Printf(TEXT("%s\n%.0f x %.0f x %.0f cm%s"), *Data.AssetName.ToString(), Size.X, Size.Y, Size.Z, Skeletal != nullptr ? TEXT(", rigged") : TEXT(""))));
		Label->SetWorldSize(10.f);
		Label->SetHorizontalAlignment(EHTA_Center);
		Label->SetVerticalAlignment(EVRTA_TextBottom);
		Label->SetTextRenderColor(FColor(255, 214, 130));
		Label->SetupAttachment(GetRootComponent());
		Label->RegisterComponent();
		Label->SetWorldLocationAndRotation(Stand + FVector(-115.0, 0.0, 2.0), FRotator(0.0, 180.0, 0.0));
		Shown.Add(Label);

		FString Skins;
		for (int32 Index = 0; Index < Model->GetNumMaterials(); ++Index)
		{
			Skins += (Index > 0 ? TEXT(", ") : TEXT("")) + GetNameSafe(Model->GetMaterial(Index));
		}
		UE_LOG(LogCrystalVein, Log, TEXT("Gallery: page %d, place %d: %s, %s, %.1f x %.1f x %.1f cm, origin %.1f, %.1f, %.1f cm from the middle of its underside, %d triangles, materials: %s"),
			Page, Place, *Data.GetObjectPathString(), Static != nullptr ? TEXT("static") : TEXT("rigged"), Size.X, Size.Y, Size.Z,
			-Box.GetCenter().X, -Box.GetCenter().Y, -Box.Min.Z, Static != nullptr ? Static->GetNumTriangles(0) : 0, *Skins);
	}
}
