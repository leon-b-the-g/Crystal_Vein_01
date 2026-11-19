#include "CVWorldView.h"
#include "CrystalVein.h"
#include "Animation/AnimSequence.h"
#include "Animation/AnimSingleNodeInstance.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SceneComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "Materials/Material.h"
#include "Materials/MaterialInstance.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "Misc/FileHelper.h"
#include "Misc/PackageName.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"

namespace
{
	// tilemap.ts's enumTile
	namespace ECVTile
	{
		enum { Floor = 0, Wall = 1, Crate = 2, Barrel = 3, Door = 4, Console = 5, Creep = 6, Table = 7, Locker = 8, Vent = 9, DoorOpen = 10, DoorLocked = 11, Breach = 13, Void = 14, Crack = 16, DiagFirst = 20, DiagLast = 23 };
	}

	enum class ECVShape : uint8 { Cube, Cylinder, Sphere };

	// The kinds of piece. Up to and including KCreep they are placed by the tiles; the rest by the snapshot.
	enum ECVKind
	{
		KFloor, KWall, KWallCap, KDoor, KDoorLocked, KLockBand, KDoorBand, KCrate, KBarrel, KConsole, KScreen, KTable, KLocker, KVent, KCreep,
		KAlien, KCorpse, KItem, KLoot, KFire, KCell, KWindow, KFlare, KNoiseBox, KNoisePip,
		KCount, KTileKinds = KCreep + 1
	};

	struct FCVKindDef
	{
		ECVShape Shape;
		FVector Size;       // cm
		double Z;           // height of the centre, cm
		FLinearColor Color; // glow kinds: emissive, so above 1 is brighter
		bool bGlow;
	};

	const double TileCm = 100.0;
	const double WallHeight = 220.0; // taller than the flashlight, low enough for the camera to see over

	// Colour rule (2026-11-10): cold blue-grey is the ship, amber is the ship asking for attention, red is alien and nothing else.
	// The glow values were first seen on 2026-11-14 (see EnsureMeshes): amber above about 1.2 washed out to pale yellow, growth at 0.55 outshone the deck.
	const FCVKindDef CVKindDefs[KCount] =
	{
		/* KFloor      */ { ECVShape::Cube,     FVector(100.0, 100.0, 10.0),       -5.0,  FLinearColor(0.060f, 0.068f, 0.078f), false },
		/* KWall       */ { ECVShape::Cube,     FVector(100.0, 100.0, WallHeight), WallHeight * 0.5, FLinearColor(0.150f, 0.165f, 0.185f), false },
		// walls are cut off black: under the fill their tops outshone the floors and the deck read as a lattice (second run, 2026-11-11)
		/* KWallCap    */ { ECVShape::Cube,     FVector(100.0, 100.0, 1.0),        WallHeight + 0.6, FLinearColor(0.004f, 0.004f, 0.005f), false },
		// a door is a leaf across its passage, thinner than the wall, with a lit strip on top: cold when it opens, amber when it wants power
		/* KDoor       */ { ECVShape::Cube,     FVector(100.0, 24.0, 205.0),       102.5, FLinearColor(0.240f, 0.270f, 0.310f), false },
		/* KDoorLocked */ { ECVShape::Cube,     FVector(100.0, 24.0, 205.0),       102.5, FLinearColor(0.200f, 0.185f, 0.160f), false },
		/* KLockBand   */ { ECVShape::Cube,     FVector(100.0, 28.0, 5.0),         208.0, FLinearColor(1.1f, 0.5f, 0.06f),      true  },
		/* KDoorBand   */ { ECVShape::Cube,     FVector(100.0, 28.0, 5.0),         208.0, FLinearColor(0.25f, 0.7f, 0.9f),      true  },
		/* KCrate      */ { ECVShape::Cube,     FVector(86.0, 86.0, 86.0),         43.0,  FLinearColor(0.190f, 0.165f, 0.120f), false },
		/* KBarrel     */ { ECVShape::Cylinder, FVector(62.0, 62.0, 92.0),         46.0,  FLinearColor(0.160f, 0.200f, 0.170f), false },
		/* KConsole    */ { ECVShape::Cube,     FVector(90.0, 90.0, 105.0),        52.5,  FLinearColor(0.085f, 0.105f, 0.130f), false },
		/* KScreen     */ { ECVShape::Cube,     FVector(60.0, 60.0, 3.0),          106.5, FLinearColor(0.35f, 1.0f, 1.3f),      true  },
		/* KTable      */ { ECVShape::Cube,     FVector(100.0, 100.0, 74.0),       37.0,  FLinearColor(0.150f, 0.155f, 0.170f), false },
		/* KLocker     */ { ECVShape::Cube,     FVector(80.0, 80.0, 190.0),        95.0,  FLinearColor(0.120f, 0.150f, 0.190f), false },
		/* KVent       */ { ECVShape::Cube,     FVector(84.0, 84.0, 2.0),          1.0,   FLinearColor(0.010f, 0.010f, 0.012f), false },
		/* KCreep      */ { ECVShape::Cube,     FVector(100.0, 100.0, 5.0),        2.5,   FLinearColor(0.2f, 0.004f, 0.003f),   true  },
		/* KAlien      */ { ECVShape::Sphere,   FVector(100.0, 100.0, 100.0),      0.0,   FLinearColor(0.090f, 0.012f, 0.012f), false },
		/* KCorpse     */ { ECVShape::Sphere,   FVector(150.0, 60.0, 24.0),        12.0,  FLinearColor(0.160f, 0.110f, 0.100f), false },
		/* KItem       */ { ECVShape::Cube,     FVector(30.0, 12.0, 8.0),          5.0,   FLinearColor(1.0f, 0.95f, 0.75f),     true  },
		/* KLoot       */ { ECVShape::Cube,     FVector(34.0, 34.0, 5.0),          0.0,   FLinearColor(1.1f, 0.5f, 0.06f),      true  },
		/* KFire       */ { ECVShape::Cube,     FVector(90.0, 90.0, 4.0),          4.0,   FLinearColor(1.6f, 0.42f, 0.04f),     true  },
		/* KCell       */ { ECVShape::Cylinder, FVector(26.0, 26.0, 44.0),         97.0,  FLinearColor(1.1f, 0.5f, 0.06f),      true  },
		/* KWindow     */ { ECVShape::Cube,     FVector(300.0, 6.0, 120.0),        130.0, FLinearColor(0.10f, 0.18f, 0.40f),    true  },
		/* KFlare      */ { ECVShape::Cylinder, FVector(7.0, 7.0, 20.0),           10.0,  FLinearColor(6.0f, 5.2f, 4.0f),       true  },
		/* KNoiseBox   */ { ECVShape::Cube,     FVector(22.0, 14.0, 9.0),          4.5,   FLinearColor(0.050f, 0.060f, 0.070f), false },
		/* KNoisePip   */ { ECVShape::Cube,     FVector(10.0, 10.0, 4.0),          11.0,  FLinearColor(0.9f, 2.4f, 3.0f),       true  },
	};

	const TCHAR* const CVKindNames[KCount] =
	{
		TEXT("Floor"), TEXT("Wall"), TEXT("WallCap"), TEXT("Door"), TEXT("DoorLocked"), TEXT("LockBand"), TEXT("DoorBand"), TEXT("Crate"), TEXT("Barrel"), TEXT("Console"), TEXT("Screen"), TEXT("Table"), TEXT("Locker"), TEXT("Vent"), TEXT("Creep"),
		TEXT("Alien"), TEXT("Corpse"), TEXT("Item"), TEXT("Loot"), TEXT("Fire"), TEXT("Cell"), TEXT("Window"), TEXT("Flare"), TEXT("NoiseBox"), TEXT("NoisePip"),
	};

	const int32 MaxFireGlows = 16;
	const int32 MaxFlareLamps = 3;
	const FLinearColor FlareLight(1.f, 0.9f, 0.76f);
	const FLinearColor AmberLight(1.f, 0.62f, 0.25f);
	const FLinearColor FireLight(1.f, 0.48f, 0.14f);
	const FLinearColor CreepLight(1.f, 0.04f, 0.03f);
	const FLinearColor ScreenLight(0.45f, 0.85f, 1.f);
	const FLinearColor WindowLight(0.35f, 0.5f, 1.f);

	// Kit.txt, in the project folder: bought assets in place of the grey boxes, or standing on them. It is read once, when the first
	// deck is built (ACVWorldView::LoadKit), and these hold what it said. There is one deck at a time.
	struct FCVKitFit
	{
		bool bSet = false;
		FVector Offset = FVector::ZeroVector; // from the middle of the box's underside to the mesh's origin, cm
		double Scale = 1.0;
		double Yaw = 0.0;
		double Height = 0.0; // of the mesh as it stands, cm
	};
	FCVKitFit CVKitFits[KCount]; // a mesh for every piece of a kind, whatever the room

	// the pieces a mesh can stand in for: those that are a plain box on the floor
	const int32 CVKitKinds[] = { KFloor, KWall, KDoor, KDoorLocked, KCrate, KBarrel, KConsole, KTable, KLocker, KVent, KCorpse, KItem, KCell, KFlare, KNoiseBox };
	const int32 KWallFace = KCount; // not a piece but a place: the side of a wall that looks into a room

	// One more line of Kit.txt: a mesh in place of the pieces of a kind in one room (bInPlace), a mesh that stands on pieces at its own
	// size, or a panel on wall faces. Without a mesh, that share of them stays as it is.
	struct FCVKitProp
	{
		int32 OnKind = 0;
		FString Room; // empty: every room
		bool bInPlace = false;
		UStaticMesh* Mesh = nullptr;
		FCVKitFit Fit;                        // in place: how it fills the box
		FVector Offset = FVector::ZeroVector; // on top: from the spot to the mesh's origin
		FVector Size = FVector::OneVector;    // the mesh's own box
		FVector Back = FVector::ZeroVector;   // the middle of the mesh's underside: on a wall face, what goes against the wall
		double Scale = 1.0;
		double Yaw = 0.0;
	};
	TArray<FCVKitProp> CVKitProps; // line i is drawn by ACVWorldView::Meshes[KCount + i]

	// an animated body for one of the sim's alien types
	struct FCVKitBody
	{
		USkeletalMesh* Mesh = nullptr;
		UAnimSequence* Idle = nullptr;
		UAnimSequence* Walk = nullptr;
		UAnimSequence* Run = nullptr;
		UAnimSequence* Hit = nullptr;
		UAnimSequence* Attack = nullptr;
		double Scale = 1.0;
		double Yaw = -90.0; // Unreal's characters are modelled facing +Y; the sim's facing is along +X
		double Lift = 0.0;
	};
	TMap<FString, FCVKitBody> CVKitBodies;

	// Only a material flagged for instanced meshes is drawn on them. In the editor Unreal sets the flag by itself; outside it (Play.bat,
	// the demo run) it draws the default grey instead and says so once in the log: until 14 Nov nothing on the deck that should glow did.
	// shortcut: the flag is set here, in memory, which only editor binaries can do; a packaged game needs it saved in the material assets.
	void AllowOnInstances(UMaterialInterface* Material)
	{
#if WITH_EDITOR
		if (UMaterial* Base = Material != nullptr ? Material->GetMaterial() : nullptr; Base != nullptr && !Base->bUsedWithInstancedStaticMeshes)
		{
			Base->bUsedWithInstancedStaticMeshes = true;
			Base->ForceRecompileForRendering();
			if (UMaterialInstance* Instance = Cast<UMaterialInstance>(Material))
			{
				Instance->ForceRecompileForRendering(); // an instance with switches of its own has its own shaders
			}
		}
#endif
	}

	// How a mesh fills the box of a kind: as large as fits, standing where the box had its underside. A flat piece (a floor plate, a
	// vent, something lying on the floor) is fitted by its footprint alone.
	FCVKitFit FitInto(const FCVKindDef& Def, const UStaticMesh* Mesh, double Scale, double Yaw, double Lift)
	{
		const FBox Box = Mesh->GetBoundingBox();
		const FVector Size = Box.GetSize().ComponentMax(FVector(1.0));
		FCVKitFit Fit;
		Fit.bSet = true;
		Fit.Scale = Scale * FMath::Min(FMath::Min(Def.Size.X / Size.X, Def.Size.Y / Size.Y), Def.Size.Z < 20.0 ? 1.0e9 : Def.Size.Z / Size.Z);
		Fit.Offset = FVector(-Box.GetCenter().X, -Box.GetCenter().Y, -Box.Min.Z) * Fit.Scale + FVector(0.0, 0.0, Lift);
		Fit.Yaw = Yaw;
		Fit.Height = Size.Z * Fit.Scale + Lift;
		return Fit;
	}

	// a piece of this kind standing on the floor at Centre; Own: the mesh that stands in for it in its room, if Kit.txt has one
	FTransform PieceAt(int32 Kind, const FVector& Centre, double Yaw = 0.0, const FCVKitFit* Own = nullptr)
	{
		const FCVKindDef& Def = CVKindDefs[Kind];
		const FCVKitFit& Fit = Own != nullptr ? *Own : CVKitFits[Kind];
		if (Fit.bSet)
		{
			// a kit mesh stands where the grey box had its underside
			const FRotator Turn(0.0, Yaw + Fit.Yaw, 0.0);
			return FTransform(Turn, Centre + FVector(0.0, 0.0, Def.Z - Def.Size.Z * 0.5) + Turn.RotateVector(Fit.Offset), FVector(Fit.Scale));
		}
		return FTransform(FRotator(0.0, Yaw, 0.0), Centre + FVector(0.0, 0.0, Def.Z), Def.Size / 100.0);
	}

	// how high a piece of this kind stands above the floor: where a prop on it goes
	double PieceTop(int32 Kind, const FCVKitFit* Own = nullptr)
	{
		const FCVKindDef& Def = CVKindDefs[Kind];
		const FCVKitFit& Fit = Own != nullptr ? *Own : CVKitFits[Kind];
		return Def.Z - Def.Size.Z * 0.5 + (Fit.bSet ? Fit.Height : Def.Size.Z);
	}

	// Kit.txt's lines for one kind at one tile: those that name the tile's room if there are any, otherwise those for every room
	void KitLines(const FCVLevel& Level, int32 Kind, const FIntPoint& Tile, bool bInPlace, TArray<int32, TInlineAllocator<8>>& Out)
	{
		const FString Room = Level.RoomAt(Tile);
		bool bOwn = false;
		for (int32 Index = 0; Index < CVKitProps.Num(); ++Index)
		{
			const FCVKitProp& Prop = CVKitProps[Index];
			if (Prop.OnKind != Kind || Prop.bInPlace != bInPlace || (!Prop.Room.IsEmpty() && Prop.Room != Room))
			{
				continue;
			}
			if (!Prop.Room.IsEmpty() && !bOwn)
			{
				bOwn = true;
				Out.Reset();
			}
			if (bOwn == !Prop.Room.IsEmpty())
			{
				Out.Add(Index);
			}
		}
	}

	// the mesh Kit.txt gives the pieces of a kind in this tile's room, if it has one for them; of several, the tile picks its own
	const FCVKitFit* RoomFit(const FCVLevel& Level, int32 Kind, const FIntPoint& Tile, int32* Line = nullptr)
	{
		TArray<int32, TInlineAllocator<8>> Choices;
		KitLines(Level, Kind, Tile, true, Choices);
		if (Choices.Num() == 0)
		{
			return nullptr;
		}
		const int32 Pick = Choices[(int32)(HashCombine(GetTypeHash(Tile.X), GetTypeHash(Tile.Y)) % (uint32)Choices.Num())];
		if (CVKitProps[Pick].Mesh == nullptr)
		{
			return nullptr; // "= none": this share of them stays as every room has them
		}
		if (Line != nullptr)
		{
			*Line = Pick;
		}
		return &CVKitProps[Pick].Fit;
	}

	// how high the piece on a tile stands: where its loot tag, its screen or the power cell goes
	double TopAt(const FCVLevel& Level, int32 Kind, int32 TileIndex)
	{
		return PieceTop(Kind, RoomFit(Level, Kind, FIntPoint(TileIndex % Level.W, TileIndex / Level.W)));
	}

	// glow=: the colour of a kit mesh's own lights, where the pack's material calls that "Emissive Color" (the sci-fi kit's do; elsewhere
	// nothing happens). The colour rule holds for bought art too: a locker's red standby lamps read in the dark as something alive.
	void TintLights(UInstancedStaticMeshComponent* Component, const FString& Glow)
	{
		if (Component == nullptr || Glow.IsEmpty())
		{
			return;
		}
		const FLinearColor Tint = Glow == TEXT("amber") ? FLinearColor(1.1f, 0.5f, 0.06f) : Glow == TEXT("cold") ? FLinearColor(0.25f, 0.7f, 0.9f) : FLinearColor::Black;
		for (int32 Slot = 0; Slot < Component->GetNumMaterials(); ++Slot)
		{
			if (UMaterialInstanceDynamic* Lit = Component->CreateDynamicMaterialInstance(Slot))
			{
				Lit->SetVectorParameterValue(TEXT("Emissive Color"), Tint);
			}
		}
	}

	bool IsWall(uint8 Tile)
	{
		return Tile == ECVTile::Wall || Tile == ECVTile::Breach || Tile == ECVTile::Void || Tile == ECVTile::Crack || (Tile >= ECVTile::DiagFirst && Tile <= ECVTile::DiagLast);
	}

	// what a door leaf can hang between: wall, the next leaf of a double door, the edge of the deck
	bool HoldsDoor(const FCVLevel& Level, int32 X, int32 Y)
	{
		if (X < 0 || Y < 0 || X >= Level.W || Y >= Level.H)
		{
			return true;
		}
		const uint8 Tile = Level.Tiles[Y * Level.W + X];
		return IsWall(Tile) || Tile == ECVTile::Door || Tile == ECVTile::DoorOpen || Tile == ECVTile::DoorLocked;
	}
}

ACVWorldView::ACVWorldView()
{
	PrimaryActorTick.bCanEverTick = false;
	SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("Root")));

	Fill = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("Fill"));
	Fill->SetupAttachment(RootComponent);
	Fill->SetRelativeRotation(FRotator(-90.0, 0.0, 0.0)); // straight down: floors and wall tops take it, wall faces stay dark
	Fill->Intensity = FillLux;
	Fill->LightColor = FColor(150, 185, 255);
	Fill->CastShadows = false;
}

void ACVWorldView::EnsureMeshes()
{
	if (Meshes.Num() >= KCount)
	{
		return;
	}
	UStaticMesh* const Shapes[] =
	{
		LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube")),
		LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cylinder.Cylinder")),
		LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Sphere.Sphere")),
	};
	// both take a vector parameter "Color"; the second is unlit and emissive
	UMaterialInterface* const LitBase = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	UMaterialInterface* const GlowBase = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/EngineMaterials/EmissiveMeshMaterial.EmissiveMeshMaterial"));
	AllowOnInstances(GlowBase); // the engine's emissive material is not flagged

	Meshes.Reset();
	for (int32 Kind = 0; Kind < KCount; ++Kind)
	{
		const FCVKindDef& Def = CVKindDefs[Kind];
		UInstancedStaticMeshComponent* Component = NewObject<UInstancedStaticMeshComponent>(this, FName(CVKindNames[Kind]));
		Component->SetStaticMesh(Shapes[(int32)Def.Shape]);
		Component->SetCollisionEnabled(ECollisionEnabled::NoCollision); // the sim does the colliding
		Component->SetCastShadow(!Def.bGlow);
		if (UMaterialInstanceDynamic* Material = UMaterialInstanceDynamic::Create(Def.bGlow ? GlowBase : LitBase, Component))
		{
			Material->SetVectorParameterValue(TEXT("Color"), Def.Color);
			Component->SetMaterial(0, Material);
		}
		Component->SetupAttachment(GetRootComponent());
		Component->RegisterComponent();
		Meshes.Add(Component);
	}
	LoadKit();
	ShownHash.Init(0, Meshes.Num());
}

// Kit.txt: the file itself says what a line may hold. A line that cannot be used is skipped with a warning, and the grey box stays.
void ACVWorldView::LoadKit()
{
	for (FCVKitFit& Fit : CVKitFits)
	{
		Fit = FCVKitFit();
	}
	CVKitProps.Reset();
	CVKitBodies.Reset();
	KitAssets.Reset();
	GrowingMeshes.Reset();
	TArray<FString> Lines;
	FFileHelper::LoadFileToStringArray(Lines, *FPaths::Combine(FPaths::ProjectDir(), TEXT("Kit.txt")));
	for (FString Line : Lines)
	{
		int32 Cut = INDEX_NONE;
		if (Line.FindChar(TEXT('#'), Cut))
		{
			Line.LeftInline(Cut);
		}
		Line.TrimStartAndEndInline();
		if (Line.IsEmpty())
		{
			continue;
		}
		// Piece [@ room] = asset, or Piece [@ room] + asset; then scale=, yaw=, z=
		int32 NameEnd = 0;
		while (NameEnd < Line.Len() && (FChar::IsAlnum(Line[NameEnd]) || Line[NameEnd] == TEXT('_')))
		{
			++NameEnd;
		}
		const FString Piece = Line.Left(NameEnd);
		FString Rest = Line.Mid(NameEnd).TrimStart();
		FString Room;
		if (Rest.StartsWith(TEXT("@")))
		{
			// the room's name runs up to the sign, which stands between two spaces
			const int32 Is = Rest.Find(TEXT(" = "), ESearchCase::CaseSensitive);
			const int32 On = Rest.Find(TEXT(" + "), ESearchCase::CaseSensitive);
			const int32 Sign = Is == INDEX_NONE ? On : On == INDEX_NONE ? Is : FMath::Min(Is, On);
			if (Sign != INDEX_NONE)
			{
				Room = Rest.Mid(1, Sign - 1).TrimStartAndEnd();
				Rest = Rest.Mid(Sign + 1);
			}
		}
		TArray<FString> Words;
		Rest.Mid(1).ParseIntoArrayWS(Words);
		if (Piece.IsEmpty() || Words.Num() == 0 || (Rest[0] != TEXT('=') && Rest[0] != TEXT('+')))
		{
			UE_LOG(LogCrystalVein, Warning, TEXT("Kit.txt: cannot read '%s'"), *Line);
			continue;
		}
		const bool bOnTop = Rest[0] == TEXT('+');
		double Scale = 1.0;
		double Yaw = 0.0;
		double Lift = 0.0;
		FParse::Value(*Rest, TEXT("scale="), Scale);
		const bool bTurned = FParse::Value(*Rest, TEXT("yaw="), Yaw);
		FParse::Value(*Rest, TEXT("z="), Lift);
		FString Glow;
		FParse::Value(*Rest, TEXT("glow="), Glow);

		// the asset as the editor's Copy Reference gives it, or just /Game/Folder/Name
		UObject* Asset = nullptr;
		if (Words[0] != TEXT("none"))
		{
			FString Path = FPackageName::ExportTextPathToObjectPath(Words[0]);
			if (!Path.Contains(TEXT(".")))
			{
				Path += TEXT(".") + FPackageName::GetShortName(Path);
			}
			Asset = StaticLoadObject(UObject::StaticClass(), nullptr, *Path, nullptr, LOAD_NoWarn);
			if (Asset == nullptr)
			{
				UE_LOG(LogCrystalVein, Warning, TEXT("Kit.txt: %s is not in this project: '%s' stays as it was"), *Path, *Piece);
				continue;
			}
			KitAssets.Add(Asset);
		}
		UStaticMesh* const Static = Cast<UStaticMesh>(Asset);
		USkeletalMesh* const Skeletal = Cast<USkeletalMesh>(Asset);
		int32 Kind = Piece == TEXT("WallFace") ? KWallFace : INDEX_NONE;
		for (int32 Index = 0; Index < KCount; ++Index)
		{
			if (Piece == CVKindNames[Index])
			{
				Kind = Index;
			}
		}
		bool bPlain = false;
		for (const int32 Plain : CVKitKinds)
		{
			bPlain |= Plain == Kind;
		}

		if (Skeletal != nullptr && !bOnTop)
		{
			// an alien's body. Its animations: the sequences of the same pack on the same skeleton, told apart by their names
			FCVKitBody Body;
			Body.Mesh = Skeletal;
			Body.Scale = Scale;
			Body.Lift = Lift;
			if (bTurned)
			{
				Body.Yaw = Yaw;
			}
			FString Pack = FPackageName::GetLongPackagePath(Skeletal->GetPackage()->GetName());
			if (const int32 Deeper = Pack.Find(TEXT("/"), ESearchCase::CaseSensitive, ESearchDir::FromStart, 6); Deeper != INDEX_NONE)
			{
				Pack.LeftInline(Deeper); // /Game/Pack
			}
			IAssetRegistry& Registry = FModuleManager::LoadModuleChecked<FAssetRegistryModule>(TEXT("AssetRegistry")).Get();
			Registry.ScanPathsSynchronous({ Pack }, false);
			TArray<FAssetData> Found;
			Registry.GetAssetsByPath(FName(*Pack), Found, true);
			Found.Sort([](const FAssetData& A, const FAssetData& B) { return A.AssetName.LexicalLess(B.AssetName); });
			UAnimSequence* Other = nullptr;
			for (const FAssetData& Data : Found)
			{
				if (Data.AssetClassPath != UAnimSequence::StaticClass()->GetClassPathName())
				{
					continue;
				}
				const FString Called = Data.AssetName.ToString();
				UAnimSequence*& Kept = Called.Contains(TEXT("Idle")) ? Body.Idle : Called.Contains(TEXT("Run")) ? Body.Run : Called.Contains(TEXT("Attack")) ? Body.Attack
					: Called.Contains(TEXT("Damage")) || Called.Contains(TEXT("Hit")) ? Body.Hit
					: Called.Contains(TEXT("Walk")) && !Called.Contains(TEXT("Back")) && !Called.Contains(TEXT("Left")) && !Called.Contains(TEXT("Right")) ? Body.Walk : Other;
				if (UAnimSequence* Sequence = Kept == nullptr ? Cast<UAnimSequence>(Data.GetAsset()) : nullptr; Sequence != nullptr && Sequence->GetSkeleton() == Skeletal->GetSkeleton())
				{
					Kept = Sequence;
					KitAssets.Add(Sequence);
				}
			}
			CVKitBodies.Add(Piece, Body);
			UE_LOG(LogCrystalVein, Log, TEXT("Kit.txt: %s is %s (idle %s, walk %s, run %s, attack %s, hit %s)"), *Piece, *Skeletal->GetName(),
				*GetNameSafe(Body.Idle), *GetNameSafe(Body.Walk), *GetNameSafe(Body.Run), *GetNameSafe(Body.Attack), *GetNameSafe(Body.Hit));
		}
		else if ((Static != nullptr || Asset == nullptr) && Kind != INDEX_NONE
			&& (bOnTop ? Kind < KTileKinds || Kind == KWallFace : bPlain && !Room.IsEmpty() && Kind < KTileKinds))
		{
			// a line of its own: on top of pieces, on wall faces, or in place of the pieces of a kind in one room
			FCVKitProp Prop;
			Prop.OnKind = Kind;
			Prop.Room = Room;
			Prop.bInPlace = !bOnTop;
			Prop.Mesh = Static;
			Prop.Scale = Scale;
			Prop.Yaw = Yaw;
			UInstancedStaticMeshComponent* Component = nullptr;
			UInstancedStaticMeshComponent* Twin = nullptr;
			if (Static != nullptr)
			{
				const FBox Box = Static->GetBoundingBox();
				Prop.Size = Box.GetSize().ComponentMax(FVector(1.0));
				Prop.Back = FVector(Box.GetCenter().X, Box.GetCenter().Y, Box.Min.Z);
				Prop.Offset = FVector(0.0, 0.0, Lift) - Prop.Back * Scale;
				if (Prop.bInPlace)
				{
					Prop.Fit = FitInto(CVKindDefs[Kind], Static, Scale, Yaw, Lift);
				}
				auto Make = [this, Static, Kind]()
				{
					UInstancedStaticMeshComponent* Made = NewObject<UInstancedStaticMeshComponent>(this);
					Made->SetStaticMesh(Static);
					Made->SetCollisionEnabled(ECollisionEnabled::NoCollision);
					Made->SetCastShadow(Kind != KCreep); // growth lies flat and is redrawn as it spreads
					Made->SetupAttachment(GetRootComponent());
					Made->RegisterComponent();
					return Made;
				};
				Component = Make();
				if (bOnTop && Kind == KCreep)
				{
					Twin = Make(); // for the tiles growth is still moving into
				}
				for (const FStaticMaterial& Slot : Static->GetStaticMaterials())
				{
					AllowOnInstances(Slot.MaterialInterface);
				}
				TintLights(Component, Glow);
				TintLights(Twin, Glow);
			}
			CVKitProps.Add(Prop);
			Meshes.Add(Component);
			GrowingMeshes.Add(Twin);
			UE_LOG(LogCrystalVein, Log, TEXT("Kit.txt: %s%s%s %s %s"), *Piece, Room.IsEmpty() ? TEXT("") : TEXT(" in "), *Room, bOnTop ? TEXT("carries") : TEXT("is"), *GetNameSafe(Static));
		}
		else if (!bOnTop && bPlain && Static != nullptr)
		{
			CVKitFits[Kind] = FitInto(CVKindDefs[Kind], Static, Scale, Yaw, Lift);
			Meshes[Kind]->SetStaticMesh(Static);
			Meshes[Kind]->EmptyOverrideMaterials(); // its own materials, not the grey box's paint
			Meshes[Kind]->SetCastShadow(true);
			for (const FStaticMaterial& Slot : Static->GetStaticMaterials())
			{
				AllowOnInstances(Slot.MaterialInterface);
			}
			TintLights(Meshes[Kind], Glow);
			UE_LOG(LogCrystalVein, Log, TEXT("Kit.txt: %s is %s, shown at %.2f of its size, %.0f cm high"), *Piece, *Static->GetName(), CVKitFits[Kind].Scale, CVKitFits[Kind].Height);
		}
		else
		{
			UE_LOG(LogCrystalVein, Warning, TEXT("Kit.txt: nothing to do with '%s'. A static mesh stands in for a piece (=) or on one (+); a skeletal mesh is an alien's body (=)"), *Line);
		}
	}
}

void ACVWorldView::Show(int32 Kind, const TArray<FTransform>& Transforms)
{
	uint32 Hash = (uint32)Transforms.Num();
	for (const FTransform& Transform : Transforms)
	{
		Hash = HashCombine(Hash, HashCombine(GetTypeHash(Transform.GetLocation()), GetTypeHash(Transform.GetScale3D())));
	}
	if (!Meshes.IsValidIndex(Kind) || Meshes[Kind] == nullptr || ShownHash[Kind] == Hash)
	{
		return; // same pieces in the same places: leave the mesh, and the lighting cached for it, alone
	}
	ShownHash[Kind] = Hash;
	Meshes[Kind]->ClearInstances();
	if (Transforms.Num() > 0)
	{
		Meshes[Kind]->AddInstances(Transforms, false);
	}
}

UPointLightComponent* ACVWorldView::LightAt(TArray<TObjectPtr<UPointLightComponent>>& Pool, int32 Index, bool bShadows)
{
	while (Pool.Num() <= Index)
	{
		UPointLightComponent* Light = NewObject<UPointLightComponent>(this);
		Light->IntensityUnits = ELightUnits::Candelas;
		Light->Intensity = 0.f;
		Light->CastShadows = bShadows;
		Light->SourceRadius = 6.f;
		Light->SetupAttachment(GetRootComponent());
		Light->RegisterComponent();
		Pool.Add(Light);
	}
	return Pool[Index];
}

FVector ACVWorldView::TileCentre(const FCVLevel& Level, int32 TileIndex, double Z) const
{
	return FVector((TileIndex % Level.W + 0.5) * TileCm, (TileIndex / Level.W + 0.5) * TileCm, Z);
}

void ACVWorldView::Build(const FCVLevel& Level)
{
	if (!Level.IsValid())
	{
		return;
	}
	EnsureMeshes();
	UnitsPerPx = (float)TileCm / Level.TileSize;
	PowerAt = -1.f;
	Things = Level.Things;
	Fill->SetIntensity(FillLux);

	LampAlways.Reset();
	LampOnAt.Reset();
	for (int32 Index = 0; Index < Level.Lamps.Num(); ++Index)
	{
		const FCVLamp& Lamp = Level.Lamps[Index];
		UPointLightComponent* Light = LightAt(Lamps, Index, bLampShadows);
		Light->SetWorldLocation(FVector(Lamp.Pos.X * UnitsPerPx, Lamp.Pos.Y * UnitsPerPx, WallHeight - 30.0)); // under the wall tops, so walls cut it
		Light->SetAttenuationRadius(FMath::Max(300.f, Lamp.Radius * UnitsPerPx * 1.6f));
		Light->SetLightColor(AmberLight);
		Light->SetIntensity(0.f);
		LampAlways.Add(Lamp.bAlways);
		LampOnAt.Add(0.f);
	}
	for (int32 Index = Level.Lamps.Num(); Index < Lamps.Num(); ++Index)
	{
		Lamps[Index]->SetIntensity(0.f);
	}

	// the viewpoint's window: a pale slab on the hull wall south of where you stand
	TArray<FTransform> WindowSlabs;
	for (const FCVThing& Thing : Things)
	{
		if (Thing.Kind == TEXT("window"))
		{
			const FCVKindDef& Def = CVKindDefs[KWindow];
			WindowSlabs.Add(FTransform(FRotator::ZeroRotator, FVector((Thing.Tile.X + 0.5) * TileCm, (Thing.Tile.Y + 1.0) * TileCm - 4.0, Def.Z), Def.Size / 100.0));
		}
	}
	Show(KWindow, WindowSlabs);
	CreepBorn.Reset(); // the growth a deck starts with is new when the deck is
	LastTick = 0;
	RefreshTiles(Level);
	UE_LOG(LogCrystalVein, Log, TEXT("Deck: %d floor, %d wall, %d doors, %d locked, %d crates, %d barrels, %d consoles, %d tables, %d lockers, %d vents, %d creep, %d lamps"),
		Meshes[KFloor]->GetInstanceCount(), Meshes[KWall]->GetInstanceCount(), Meshes[KDoorBand]->GetInstanceCount(), Meshes[KLockBand]->GetInstanceCount(), Meshes[KCrate]->GetInstanceCount(),
		Meshes[KBarrel]->GetInstanceCount(), Meshes[KConsole]->GetInstanceCount(), Meshes[KTable]->GetInstanceCount(), Meshes[KLocker]->GetInstanceCount(), Meshes[KVent]->GetInstanceCount(),
		Meshes[KCreep]->GetInstanceCount(), Level.Lamps.Num());
}

void ACVWorldView::SetSurveyLight(bool bOn)
{
	Fill->SetIntensity(bOn ? 60.f : FillLux);
}

void ACVWorldView::RefreshTiles(const FCVLevel& Level)
{
	if (!Level.IsValid())
	{
		return;
	}
	EnsureMeshes();
	TArray<FTransform> Wanted[KTileKinds];
	TArray<TArray<FTransform>> Extra; // what Kit.txt's lines draw: line i goes to Meshes[KCount + i]
	Extra.SetNum(CVKitProps.Num());
	const bool bPanels = CVKitProps.ContainsByPredicate([](const FCVKitProp& Prop) { return Prop.OnKind == KWallFace; });

	// One piece on its tile: the grey box, the mesh Kit.txt gives its kind, or the one it gives the kind in this room; then what stands
	// on it. A tile that holds one of the story's things (a terminal, the generator, the cell's rack) carries nothing. Gives its height.
	auto Put = [&](int32 Kind, const FVector& At, double Yaw = 0.0) -> double
	{
		const FIntPoint Spot(FMath::FloorToInt32(At.X / TileCm), FMath::FloorToInt32(At.Y / TileCm));
		const uint32 Seed = HashCombine(GetTypeHash(Spot.X), GetTypeHash(Spot.Y));
		TArray<int32, TInlineAllocator<8>> Choices;
		KitLines(Level, Kind, Spot, false, Choices);
		const bool bCarries = Choices.Num() > 0 && !Things.ContainsByPredicate([&Spot](const FCVThing& Thing) { return Thing.Tile == Spot; });
		const FCVKitProp* const Prop = bCarries ? &CVKitProps[Choices[(int32)((Seed >> 4) % (uint32)Choices.Num())]] : nullptr;
		int32 Line = INDEX_NONE;
		const FCVKitFit* const Own = RoomFit(Level, Kind, Spot, &Line);
		if (Own != nullptr)
		{
			Extra[Line].Add(PieceAt(Kind, At, Yaw, Own));
		}
		else if (Kind != KCreep || Prop == nullptr || Prop->Mesh == nullptr)
		{
			Wanted[Kind].Add(PieceAt(Kind, At, Yaw)); // growth with flesh to lie there shows no red square under it: squares are not organic
		}
		const double Top = PieceTop(Kind, Own);
		if (Prop != nullptr && Prop->Mesh != nullptr)
		{
			const FRotator Spin(0.0, Prop->Yaw + (double)((Seed >> 8) % 360u), 0.0);
			Extra[(int32)(Prop - CVKitProps.GetData())].Add(FTransform(Spin, At + FVector(0.0, 0.0, Top) + Spin.RotateVector(Prop->Offset), FVector(Prop->Scale)));
		}
		return Top;
	};

	// Furniture stands with its back to a wall: of the walls beside it (north, west, south, east) the first with open floor in front, or
	// else the first. Kit meshes are modelled looking along +Y, which is south on the deck; yaw= in Kit.txt turns one that is not.
	auto Backed = [&Level](int32 X, int32 Y) -> double
	{
		auto TileAt = [&Level](int32 TX, int32 TY) -> uint8 { return TX < 0 || TY < 0 || TX >= Level.W || TY >= Level.H ? (uint8)ECVTile::Wall : Level.Tiles[TY * Level.W + TX]; };
		static const int32 Sides[4][3] = { { 0, -1, 0 }, { -1, 0, -90 }, { 0, 1, 180 }, { 1, 0, 90 } };
		for (int32 Pass = 0; Pass < 2; ++Pass)
		{
			for (int32 Index = 0; Index < 4; ++Index)
			{
				const int32* const Side = Sides[Index];
				const uint8 Front = TileAt(X - Side[0], Y - Side[1]);
				const bool bOpen = !IsWall(Front) && Front != ECVTile::Crate && Front != ECVTile::Barrel && Front != ECVTile::Console && Front != ECVTile::Table
					&& Front != ECVTile::Locker && Front != ECVTile::Door && Front != ECVTile::DoorLocked;
				if (IsWall(TileAt(X + Side[0], Y + Side[1])) && (Pass == 1 || bOpen))
				{
					return (double)Side[2];
				}
			}
		}
		return 0.0;
	};

	TMap<FIntPoint, FVector> CreepClusters; // 3 x 3 tile blocks: X, Y summed, Z the count
	TMap<FIntPoint, int32> ClusterBorn;     // ... and the tick at which their oldest tile turned to growth
	for (int32 Index = 0; Index < Level.Tiles.Num(); ++Index)
	{
		const uint8 Tile = Level.Tiles[Index];
		const FVector Centre = TileCentre(Level, Index, 0.0);
		const int32 X = Index % Level.W;
		const int32 Y = Index / Level.W;
		if (IsWall(Tile))
		{
			Put(KWall, Centre);
			Put(KWallCap, Centre);
			// Kit.txt's panels: one on each side of a wall that looks into a room or a passage; a doorway's cheeks stay bare
			for (int32 Side = 0; Side < 4 && bPanels; ++Side)
			{
				const FIntPoint Step(Side == 0 ? 1 : Side == 2 ? -1 : 0, Side == 1 ? 1 : Side == 3 ? -1 : 0);
				const FIntPoint Next(X + Step.X, Y + Step.Y);
				if (Next.X < 0 || Next.Y < 0 || Next.X >= Level.W || Next.Y >= Level.H)
				{
					continue;
				}
				const uint8 Beyond = Level.Tiles[Next.Y * Level.W + Next.X];
				TArray<int32, TInlineAllocator<8>> Choices;
				if (!IsWall(Beyond) && Beyond != ECVTile::Door && Beyond != ECVTile::DoorOpen && Beyond != ECVTile::DoorLocked)
				{
					KitLines(Level, KWallFace, Next, false, Choices);
				}
				if (Choices.Num() == 0)
				{
					continue;
				}
				const uint32 Seed = HashCombine(HashCombine(GetTypeHash(Next.X), GetTypeHash(Next.Y)), GetTypeHash(Side));
				const int32 Pick = Choices[(int32)(Seed % (uint32)Choices.Num())];
				const FCVKitProp& Prop = CVKitProps[Pick];
				// the panel is modelled lying down: its length goes along the wall, its width up the wall, its top out into the room
				const FVector Out((double)Step.X, (double)Step.Y, 0.0);
				const FVector Grow(TileCm / Prop.Size.X, WallHeight / Prop.Size.Y, FMath::Min(TileCm / Prop.Size.X, WallHeight / Prop.Size.Y));
				const FQuat Stand(FMatrix(FVector::UpVector ^ Out, FVector::UpVector, Out, FVector::ZeroVector));
				Extra[Pick].Add(FTransform(Stand, Centre + Out * (TileCm * 0.5 + 0.5) + FVector(0.0, 0.0, WallHeight * 0.5) - Stand.RotateVector(Prop.Back * Grow), Grow));
			}
			continue;
		}
		Put(KFloor, Centre);
		// a leaf lies along X when the wall carries on to its left and right; otherwise it is turned a quarter
		const double Turn = HoldsDoor(Level, X - 1, Y) && HoldsDoor(Level, X + 1, Y) ? 0.0 : 90.0;
		switch (Tile)
		{
		case ECVTile::Crate: Put(KCrate, Centre, Backed(X, Y)); break;
		case ECVTile::Barrel: Put(KBarrel, Centre, Backed(X, Y)); break;
		case ECVTile::Door: Put(KDoor, Centre, Turn); Put(KDoorBand, Centre, Turn); break;
		case ECVTile::DoorLocked: Put(KDoorLocked, Centre, Turn); Put(KLockBand, Centre, Turn); break;
		case ECVTile::Console:
		{
			// a terminal's screen lies on whatever stands there; a console that is another of the story's things (the generator) has none
			const double Top = Put(KConsole, Centre, Backed(X, Y));
			const FCVThing* const Held = Things.FindByPredicate([X, Y](const FCVThing& Each) { return Each.Tile == FIntPoint(X, Y); });
			if (Held == nullptr || Held->Kind == TEXT("terminal"))
			{
				Wanted[KScreen].Add(FTransform(FRotator::ZeroRotator, Centre + FVector(0.0, 0.0, Top + 1.5), CVKindDefs[KScreen].Size / 100.0));
			}
			break;
		}
		case ECVTile::Table: Put(KTable, Centre, Backed(X, Y)); break;
		case ECVTile::Locker: Put(KLocker, Centre, Backed(X, Y)); break;
		case ECVTile::Vent: Put(KVent, Centre); break;
		case ECVTile::Creep:
		{
			Put(KCreep, Centre);
			const FIntPoint Block(X / 3, Y / 3);
			CreepClusters.FindOrAdd(Block, FVector::ZeroVector) += FVector(Centre.X, Centre.Y, 1.0);
			const int32 Born = CreepBorn.FindOrAdd(Index, LastTick);
			int32& Oldest = ClusterBorn.FindOrAdd(Block, Born);
			Oldest = FMath::Min(Oldest, Born);
			break;
		}
		default: break; // an open door is its floor
		}
	}
	for (int32 Kind = 0; Kind < KTileKinds; ++Kind)
	{
		Show(Kind, Wanted[Kind]);
	}
	for (int32 Index = 0; Index < CVKitProps.Num(); ++Index)
	{
		Show(KCount + Index, Extra[Index]);
	}
	for (auto Gone = CreepBorn.CreateIterator(); Gone; ++Gone)
	{
		if (Level.Tiles[Gone.Key()] != ECVTile::Creep)
		{
			Gone.RemoveCurrent(); // burned off
		}
	}

	CreepGlows.Reset();
	CreepGlowBorn.Reset();
	for (const TPair<FIntPoint, FVector>& Cluster : CreepClusters)
	{
		FCVGlow& Glow = CreepGlows.AddDefaulted_GetRef();
		Glow.Pos = FVector(Cluster.Value.X / Cluster.Value.Z, Cluster.Value.Y / Cluster.Value.Z, 35.0);
		Glow.Color = CreepLight;
		Glow.Candelas = CreepCandelas * (float)Cluster.Value.Z;
		Glow.Radius = 320.f;
		CreepGlowBorn.Add(ClusterBorn.FindRef(Cluster.Key));
	}
}

void ACVWorldView::PowerUp()
{
	PowerAt = (float)GetWorld()->GetTimeSeconds();
	for (int32 Index = 0; Index < LampOnAt.Num(); ++Index)
	{
		LampOnAt[Index] = PowerAt + FMath::FRandRange(0.1f, 1.8f);
	}
}

void ACVWorldView::Apply(const FCVLevel& Level, const FCVSnap& Snap)
{
	if (!Level.IsValid() || Meshes.Num() < KCount)
	{
		return;
	}
	const float Now = (float)GetWorld()->GetTimeSeconds();
	LastTick = Snap.Tick;
	TArray<FTransform> Transforms;
	TArray<FCVGlow, TInlineAllocator<8>> Sparks;

	// aliens: the animated body Kit.txt gives their type; without one, a dark ellipsoid along the way it faces, half out of the vent while
	// it climbs. Rearing to strike, it flares red: the moment to step back. Struck, it sparks pale (Leon, 2026-11-18: no feedback).
	TSet<int32> Seen;
	for (const FCVAlien& Alien : Snap.Aliens)
	{
		const FVector Feet(Alien.Pos.X * UnitsPerPx, Alien.Pos.Y * UnitsPerPx, 0.0);
		const bool bStrikes = (Alien.Flags & (ECVAlienFlag::Rearing | ECVAlienFlag::Striking)) != 0;
		if (bStrikes || (Alien.Flags & ECVAlienFlag::Hit) != 0)
		{
			FCVGlow& Spark = Sparks.AddDefaulted_GetRef();
			Spark.Pos = Feet + FVector(0.0, 0.0, 70.0);
			Spark.Color = bStrikes ? CreepLight : FlareLight;
			Spark.Candelas = bStrikes ? 45.f : 16.f;
			Spark.Radius = bStrikes ? 380.f : 240.f;
		}
		if (const FCVKitBody* Kit = CVKitBodies.Find(Alien.Type))
		{
			Seen.Add(Alien.Id);
			TObjectPtr<USkeletalMeshComponent>& Figure = Bodies.FindOrAdd(Alien.Id);
			if (Figure == nullptr)
			{
				Figure = NewObject<USkeletalMeshComponent>(this);
				Figure->SetSkeletalMeshAsset(Kit->Mesh);
				Figure->SetCollisionEnabled(ECollisionEnabled::NoCollision);
				Figure->SetupAttachment(GetRootComponent());
				Figure->RegisterComponent();
			}
			Figure->SetWorldTransform(FTransform(FRotator(0.0, FMath::RadiansToDegrees(Alien.Facing) + Kit->Yaw, 0.0), Feet + FVector(0.0, 0.0, Kit->Lift), FVector(Kit->Scale)));
			// shortcut: one sequence at a time, cut to the next without a blend, and no death (a dead one is only a place in the
			// snapshot); an animation blueprint when the art is real
			const bool bMoving = (Alien.Flags & ECVAlienFlag::Moving) != 0;
			UAnimSequence* const Motion = bStrikes && Kit->Attack != nullptr ? Kit->Attack
				: (Alien.Flags & ECVAlienFlag::Hit) != 0 && Kit->Hit != nullptr ? Kit->Hit
				: bMoving && (Alien.Flags & ECVAlienFlag::Chasing) != 0 && Kit->Run != nullptr ? Kit->Run
				: bMoving && Kit->Walk != nullptr ? Kit->Walk : Kit->Idle;
			UAnimSingleNodeInstance* const Playing = Figure->GetSingleNodeInstance();
			if (Motion != nullptr && (Playing == nullptr || Playing->GetAnimationAsset() != Motion))
			{
				Figure->PlayAnimation(Motion, true);
			}
			continue;
		}
		const double Girth = Alien.Radius * UnitsPerPx * 2.6 / 100.0 * (bStrikes ? 1.3 : 1.0);
		const double Rise = (Alien.Flags & ECVAlienFlag::Emerging) != 0 ? 0.4 : 1.0;
		Transforms.Add(FTransform(FRotator(0.0, FMath::RadiansToDegrees(Alien.Facing), 0.0), Feet + FVector(0.0, 0.0, Girth * 35.0 * Rise), FVector(Girth * 1.3, Girth, Girth * 0.7 * Rise)));
	}
	Show(KAlien, Transforms);
	for (auto Gone = Bodies.CreateIterator(); Gone; ++Gone)
	{
		if (!Seen.Contains(Gone.Key()))
		{
			if (Gone.Value() != nullptr)
			{
				Gone.Value()->DestroyComponent();
			}
			Gone.RemoveCurrent();
		}
	}

	Transforms.Reset();
	for (const FVector2D& Corpse : Snap.Corpses)
	{
		Transforms.Add(PieceAt(KCorpse, FVector(Corpse.X * UnitsPerPx, Corpse.Y * UnitsPerPx, 0.0)));
	}
	Show(KCorpse, Transforms);

	Transforms.Reset();
	for (const FCVItem& Item : Snap.Items)
	{
		Transforms.Add(PieceAt(KItem, FVector(Item.Pos.X * UnitsPerPx, Item.Pos.Y * UnitsPerPx, 0.0)));
	}
	Show(KItem, Transforms);

	// what still holds something wears an amber tag on top; a plain crate or an emptied one wears none (players, 2026-11-10)
	Transforms.Reset();
	for (const int32 TileIndex : Snap.Loot)
	{
		if (Level.Tiles.IsValidIndex(TileIndex))
		{
			const uint8 Tile = Level.Tiles[TileIndex];
			const double Top = Tile == ECVTile::Crate ? TopAt(Level, KCrate, TileIndex) : Tile == ECVTile::Locker ? TopAt(Level, KLocker, TileIndex) : 26.0;
			Transforms.Add(PieceAt(KLoot, TileCentre(Level, TileIndex, Top + 3.0)));
		}
	}
	Show(KLoot, Transforms);

	Transforms.Reset();
	for (const int32 TileIndex : Snap.Fires)
	{
		if (Level.Tiles.IsValidIndex(TileIndex))
		{
			Transforms.Add(PieceAt(KFire, TileCentre(Level, TileIndex, 0.0)));
		}
	}
	Show(KFire, Transforms);

	// thrown things: a flare is a light that sputters and dies down over its last seconds; a noisemaker blinks in time with its beep
	TArray<FTransform> Flares;
	TArray<FTransform> Boxes;
	TArray<FTransform> Pips;
	TArray<FVector, TInlineAllocator<4>> Blinks;
	int32 FlareCount = 0;
	const bool bPip = FMath::Fmod(Now, 1.2f) < 0.3f;
	for (const FCVThrown& Thing : Snap.Thrown)
	{
		const FVector At(Thing.Pos.X * UnitsPerPx, Thing.Pos.Y * UnitsPerPx, Thing.bFlying ? 70.0 : 0.0);
		if (Thing.Kind == 0)
		{
			Flares.Add(PieceAt(KFlare, At));
			if (FlareCount < MaxFlareLamps)
			{
				UPointLightComponent* Light = LightAt(FlareLamps, FlareCount++, true);
				Light->SetWorldLocation(At + FVector(0.0, 0.0, 60.0)); // a little above the stick: from the floor itself it lights the floor badly
				Light->SetLightColor(FlareLight);
				Light->SetAttenuationRadius(900.f);
				Light->SetIntensity(FlareCandelas * (0.72f + 0.28f * FMath::PerlinNoise1D(Now * 9.f + (float)FlareCount)) * (Thing.bFlying ? 1.f : FMath::Clamp(Thing.Left / 3.f, 0.f, 1.f)));
			}
		}
		else if (Thing.Kind == 1)
		{
			Boxes.Add(PieceAt(KNoiseBox, At));
			if (bPip && !Thing.bFlying)
			{
				Pips.Add(PieceAt(KNoisePip, At));
				Blinks.Add(At + FVector(0.0, 0.0, 30.0));
			}
		}
	}
	for (int32 Index = FlareCount; Index < FlareLamps.Num(); ++Index)
	{
		FlareLamps[Index]->SetIntensity(0.f);
	}
	Show(KFlare, Flares);
	Show(KNoiseBox, Boxes);
	Show(KNoisePip, Pips);

	// growth on its way into a tile: the piece that will cover it swells in from the side it comes from
	TArray<TArray<FTransform>> Swelling;
	Swelling.SetNum(GrowingMeshes.Num());
	for (const FCVGrowing& Grow : Snap.Growing)
	{
		if (!Level.Tiles.IsValidIndex(Grow.Tile))
		{
			continue;
		}
		const FIntPoint Spot(Grow.Tile % Level.W, Grow.Tile / Level.W);
		TArray<int32, TInlineAllocator<8>> Choices;
		KitLines(Level, KCreep, Spot, false, Choices);
		if (Choices.Num() == 0)
		{
			continue; // no growth mesh in Kit.txt: the tile still turns red all at once
		}
		const uint32 Seed = HashCombine(GetTypeHash(Spot.X), GetTypeHash(Spot.Y));
		const int32 Pick = Choices[(int32)((Seed >> 4) % (uint32)Choices.Num())];
		const FCVKitProp& Prop = CVKitProps[Pick];
		const double Done = FMath::Clamp((double)Grow.Done, 0.0, 1.0);
		const double Swell = 0.15 + 0.85 * Done;
		const FVector From(Grow.Side == 0 ? -1.0 : Grow.Side == 2 ? 1.0 : 0.0, Grow.Side == 1 ? -1.0 : Grow.Side == 3 ? 1.0 : 0.0, 0.0);
		const FRotator Spin(0.0, Prop.Yaw + (double)((Seed >> 8) % 360u), 0.0);
		Swelling[Pick].Add(FTransform(Spin, TileCentre(Level, Grow.Tile, PieceTop(KCreep)) + From * (TileCm * 0.5 * (1.0 - Done)) + Spin.RotateVector(Prop.Offset * Swell), FVector(Prop.Scale * Swell)));
	}
	for (int32 Index = 0; Index < GrowingMeshes.Num(); ++Index)
	{
		if (UInstancedStaticMeshComponent* Twin = GrowingMeshes[Index]; Twin != nullptr && (Twin->GetInstanceCount() > 0 || Swelling[Index].Num() > 0))
		{
			Twin->ClearInstances();
			if (Swelling[Index].Num() > 0)
			{
				Twin->AddInstances(Swelling[Index], false);
			}
		}
	}

	// the power cell sits on its rack until you carry it off
	const bool bCellOnRack = !Snap.bPower && !Snap.Has(ECVFlag::HasCell);
	Transforms.Reset();
	for (const FCVThing& Thing : Things)
	{
		if (bCellOnRack && Thing.Kind == TEXT("cell"))
		{
			// its box was made for the grey table, 74 cm high
			Transforms.Add(PieceAt(KCell, FVector((Thing.Tile.X + 0.5) * TileCm, (Thing.Tile.Y + 0.5) * TileCm, TopAt(Level, KTable, Thing.Tile.Y * Level.W + Thing.Tile.X) - 74.0)));
		}
	}
	Show(KCell, Transforms);

	// lamps: the battery lamp always; the rest once the generator runs, each stuttering on in its own time
	if (Snap.bPower && PowerAt < 0.f)
	{
		PowerUp();
	}
	// Emergency power is not daylight (Leon, 2026-11-18: lean into the dark): two lamps in three come back, at a little over half
	// strength, and one in four of those never settles.
	for (int32 Index = 0; Index < LampOnAt.Num() && Index < Lamps.Num(); ++Index)
	{
		float Level01 = LampAlways[Index] ? 1.f : 0.f;
		if (!LampAlways[Index] && Index % 3 != 1 && Snap.bPower && Now >= LampOnAt[Index])
		{
			const bool bLoose = Index % 4 == 2 && FMath::PerlinNoise1D(Now * 1.7f + (float)Index * 7.3f) > 0.2f;
			Level01 = Now - LampOnAt[Index] < 0.7f ? (FMath::FRand() < 0.5f ? 0.1f : 0.6f) : bLoose ? 0.08f : 0.6f;
		}
		Lamps[Index]->SetIntensity(LampCandelas * Level01);
	}

	// glows: fires (a share of them when a whole patch burns), creep, the screens and the cell
	TArray<FCVGlow, TInlineAllocator<64>> Wanted;
	const int32 FireStep = FMath::Max(1, FMath::DivideAndRoundUp(Snap.Fires.Num(), MaxFireGlows));
	for (int32 Index = 0; Index < Snap.Fires.Num(); Index += FireStep)
	{
		const int32 TileIndex = Snap.Fires[Index];
		if (Level.Tiles.IsValidIndex(TileIndex))
		{
			FCVGlow& Glow = Wanted.AddDefaulted_GetRef();
			Glow.Pos = TileCentre(Level, TileIndex, 55.0);
			Glow.Color = FireLight;
			Glow.Candelas = FireCandelas * (0.7f + 0.3f * FMath::PerlinNoise1D(Now * 7.f + (float)TileIndex));
			Glow.Radius = 600.f;
		}
	}
	for (int32 Index = 0; Index < CreepGlows.Num(); ++Index)
	{
		// Growth breathes. From the minute it starts to harden it beats, faster and brighter, and hard it burns: that is the growth that eats you.
		FCVGlow Glow = CreepGlows[Index];
		const float Age = (float)(Snap.Tick - CreepGlowBorn[Index]) / 60.f;
		const float Beat = Age >= Level.CreepHard ? 2.6f : Age >= Level.CreepHarden ? 1.3f : 0.3f;
		Glow.Candelas *= (Age >= Level.CreepHard ? 2.6f : Age >= Level.CreepHarden ? 1.5f : 1.f) * (0.72f + 0.28f * FMath::Sin(Now * Beat * 6.2832f + (float)Index));
		Wanted.Add(Glow);
	}
	Wanted.Append(Sparks);
	for (const FVector& Blink : Blinks)
	{
		// the box is small: its blink on the floor around it is what you see from above
		FCVGlow& Glow = Wanted.AddDefaulted_GetRef();
		Glow.Pos = Blink;
		Glow.Color = ScreenLight;
		Glow.Candelas = 6.f;
		Glow.Radius = 260.f;
	}
	for (const FCVThing& Thing : Things)
	{
		const FVector Centre((Thing.Tile.X + 0.5) * TileCm, (Thing.Tile.Y + 0.5) * TileCm, 125.0);
		FCVGlow Glow;
		Glow.Pos = Centre;
		Glow.Candelas = ScreenCandelas;
		if (Thing.Kind == TEXT("terminal"))
		{
			Glow.Color = ScreenLight;
		}
		else if (Thing.Kind == TEXT("generator"))
		{
			Glow.Color = Snap.bPower ? ScreenLight : AmberLight; // amber until it runs
		}
		else if (Thing.Kind == TEXT("cell") && bCellOnRack)
		{
			Glow.Color = AmberLight;
		}
		else if (Thing.Kind == TEXT("window"))
		{
			Glow.Pos = Centre + FVector(0.0, 40.0, 20.0);
			Glow.Color = WindowLight;
			Glow.Radius = 520.f;
		}
		else
		{
			continue;
		}
		Wanted.Add(Glow);
	}
	for (int32 Index = 0; Index < Wanted.Num(); ++Index)
	{
		UPointLightComponent* Light = LightAt(Glows, Index, false);
		Light->SetWorldLocation(Wanted[Index].Pos);
		Light->SetLightColor(Wanted[Index].Color);
		Light->SetAttenuationRadius(Wanted[Index].Radius);
		Light->SetIntensity(Wanted[Index].Candelas);
	}
	for (int32 Index = Wanted.Num(); Index < Glows.Num(); ++Index)
	{
		Glows[Index]->SetIntensity(0.f);
	}
}
