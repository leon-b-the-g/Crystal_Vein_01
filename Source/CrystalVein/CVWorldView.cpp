#include "CVWorldView.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SceneComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"

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
		KFloor, KWall, KDoor, KDoorLocked, KLockBand, KCrate, KBarrel, KConsole, KScreen, KTable, KLocker, KVent, KCreep,
		KAlien, KCorpse, KItem, KLoot, KFire, KCell, KWindow,
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
	const FCVKindDef CVKindDefs[KCount] =
	{
		/* KFloor      */ { ECVShape::Cube,     FVector(100.0, 100.0, 10.0),       -5.0,  FLinearColor(0.060f, 0.068f, 0.078f), false },
		/* KWall       */ { ECVShape::Cube,     FVector(100.0, 100.0, WallHeight), WallHeight * 0.5, FLinearColor(0.150f, 0.165f, 0.185f), false },
		/* KDoor       */ { ECVShape::Cube,     FVector(100.0, 100.0, 205.0),      102.5, FLinearColor(0.240f, 0.270f, 0.310f), false },
		/* KDoorLocked */ { ECVShape::Cube,     FVector(100.0, 100.0, 205.0),      102.5, FLinearColor(0.200f, 0.185f, 0.160f), false },
		/* KLockBand   */ { ECVShape::Cube,     FVector(103.0, 103.0, 6.0),        150.0, FLinearColor(2.4f, 1.1f, 0.12f),      true  },
		/* KCrate      */ { ECVShape::Cube,     FVector(86.0, 86.0, 86.0),         43.0,  FLinearColor(0.190f, 0.165f, 0.120f), false },
		/* KBarrel     */ { ECVShape::Cylinder, FVector(62.0, 62.0, 92.0),         46.0,  FLinearColor(0.160f, 0.200f, 0.170f), false },
		/* KConsole    */ { ECVShape::Cube,     FVector(90.0, 90.0, 105.0),        52.5,  FLinearColor(0.085f, 0.105f, 0.130f), false },
		/* KScreen     */ { ECVShape::Cube,     FVector(60.0, 60.0, 3.0),          106.5, FLinearColor(0.35f, 1.0f, 1.3f),      true  },
		/* KTable      */ { ECVShape::Cube,     FVector(100.0, 100.0, 74.0),       37.0,  FLinearColor(0.150f, 0.155f, 0.170f), false },
		/* KLocker     */ { ECVShape::Cube,     FVector(80.0, 80.0, 190.0),        95.0,  FLinearColor(0.120f, 0.150f, 0.190f), false },
		/* KVent       */ { ECVShape::Cube,     FVector(84.0, 84.0, 2.0),          1.0,   FLinearColor(0.010f, 0.010f, 0.012f), false },
		/* KCreep      */ { ECVShape::Cube,     FVector(100.0, 100.0, 5.0),        2.5,   FLinearColor(0.55f, 0.012f, 0.008f),  true  },
		/* KAlien      */ { ECVShape::Sphere,   FVector(100.0, 100.0, 100.0),      0.0,   FLinearColor(0.090f, 0.012f, 0.012f), false },
		/* KCorpse     */ { ECVShape::Sphere,   FVector(150.0, 60.0, 24.0),        12.0,  FLinearColor(0.160f, 0.110f, 0.100f), false },
		/* KItem       */ { ECVShape::Cube,     FVector(30.0, 12.0, 8.0),          5.0,   FLinearColor(1.0f, 0.95f, 0.75f),     true  },
		/* KLoot       */ { ECVShape::Cube,     FVector(34.0, 34.0, 5.0),          0.0,   FLinearColor(2.6f, 1.25f, 0.14f),     true  },
		/* KFire       */ { ECVShape::Cube,     FVector(90.0, 90.0, 4.0),          4.0,   FLinearColor(5.0f, 1.5f, 0.12f),      true  },
		/* KCell       */ { ECVShape::Cylinder, FVector(26.0, 26.0, 44.0),         97.0,  FLinearColor(2.6f, 1.25f, 0.14f),     true  },
		/* KWindow     */ { ECVShape::Cube,     FVector(300.0, 6.0, 120.0),        130.0, FLinearColor(0.10f, 0.18f, 0.40f),    true  },
	};

	const TCHAR* const CVKindNames[KCount] =
	{
		TEXT("Floor"), TEXT("Wall"), TEXT("Door"), TEXT("DoorLocked"), TEXT("LockBand"), TEXT("Crate"), TEXT("Barrel"), TEXT("Console"), TEXT("Screen"), TEXT("Table"), TEXT("Locker"), TEXT("Vent"), TEXT("Creep"),
		TEXT("Alien"), TEXT("Corpse"), TEXT("Item"), TEXT("Loot"), TEXT("Fire"), TEXT("Cell"), TEXT("Window"),
	};

	const int32 MaxFireGlows = 16;
	const FLinearColor AmberLight(1.f, 0.62f, 0.25f);
	const FLinearColor FireLight(1.f, 0.48f, 0.14f);
	const FLinearColor CreepLight(1.f, 0.04f, 0.03f);
	const FLinearColor ScreenLight(0.45f, 0.85f, 1.f);
	const FLinearColor WindowLight(0.35f, 0.5f, 1.f);

	// a piece of this kind standing on the floor at Centre
	FTransform PieceAt(int32 Kind, const FVector& Centre)
	{
		const FCVKindDef& Def = CVKindDefs[Kind];
		return FTransform(FRotator::ZeroRotator, Centre + FVector(0.0, 0.0, Def.Z), Def.Size / 100.0);
	}
}

ACVWorldView::ACVWorldView()
{
	PrimaryActorTick.bCanEverTick = false;
	SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("Root")));
}

void ACVWorldView::EnsureMeshes()
{
	if (Meshes.Num() == KCount)
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

	Meshes.Reset();
	ShownHash.Init(0, KCount);
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
}

void ACVWorldView::Show(int32 Kind, const TArray<FTransform>& Transforms)
{
	uint32 Hash = (uint32)Transforms.Num();
	for (const FTransform& Transform : Transforms)
	{
		Hash = HashCombine(Hash, HashCombine(GetTypeHash(Transform.GetLocation()), GetTypeHash(Transform.GetScale3D())));
	}
	if (!Meshes.IsValidIndex(Kind) || ShownHash[Kind] == Hash)
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
	RefreshTiles(Level);
}

void ACVWorldView::RefreshTiles(const FCVLevel& Level)
{
	if (!Level.IsValid())
	{
		return;
	}
	EnsureMeshes();
	TArray<FTransform> Wanted[KTileKinds];
	auto Put = [&Wanted](int32 Kind, const FVector& At) { Wanted[Kind].Add(PieceAt(Kind, At)); };
	TMap<FIntPoint, FVector> CreepClusters; // 3 x 3 tile blocks: X, Y summed, Z the count
	for (int32 Index = 0; Index < Level.Tiles.Num(); ++Index)
	{
		const uint8 Tile = Level.Tiles[Index];
		const FVector Centre = TileCentre(Level, Index, 0.0);
		if (Tile == ECVTile::Wall || Tile == ECVTile::Breach || Tile == ECVTile::Void || Tile == ECVTile::Crack || (Tile >= ECVTile::DiagFirst && Tile <= ECVTile::DiagLast))
		{
			Put(KWall, Centre);
			continue;
		}
		Put(KFloor, Centre);
		switch (Tile)
		{
		case ECVTile::Crate: Put(KCrate, Centre); break;
		case ECVTile::Barrel: Put(KBarrel, Centre); break;
		case ECVTile::Door: Put(KDoor, Centre); break;
		case ECVTile::DoorLocked: Put(KDoorLocked, Centre); Put(KLockBand, Centre); break;
		case ECVTile::Console: Put(KConsole, Centre); Put(KScreen, Centre); break;
		case ECVTile::Table: Put(KTable, Centre); break;
		case ECVTile::Locker: Put(KLocker, Centre); break;
		case ECVTile::Vent: Put(KVent, Centre); break;
		case ECVTile::Creep:
		{
			Put(KCreep, Centre);
			const FIntPoint Block((Index % Level.W) / 3, (Index / Level.W) / 3);
			FVector* Cluster = CreepClusters.Find(Block);
			if (Cluster == nullptr)
			{
				Cluster = &CreepClusters.Add(Block, FVector::ZeroVector);
			}
			*Cluster += FVector(Centre.X, Centre.Y, 1.0);
			break;
		}
		default: break; // an open door is its floor
		}
	}
	for (int32 Kind = 0; Kind < KTileKinds; ++Kind)
	{
		Show(Kind, Wanted[Kind]);
	}

	CreepGlows.Reset();
	for (const TPair<FIntPoint, FVector>& Cluster : CreepClusters)
	{
		FCVGlow& Glow = CreepGlows.AddDefaulted_GetRef();
		Glow.Pos = FVector(Cluster.Value.X / Cluster.Value.Z, Cluster.Value.Y / Cluster.Value.Z, 35.0);
		Glow.Color = CreepLight;
		Glow.Candelas = CreepCandelas * (float)Cluster.Value.Z;
		Glow.Radius = 320.f;
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
	if (!Level.IsValid() || Meshes.Num() != KCount)
	{
		return;
	}
	const float Now = (float)GetWorld()->GetTimeSeconds();
	TArray<FTransform> Transforms;

	// aliens: a dark ellipsoid along the way it faces; half out of the vent while it climbs
	for (const FCVAlien& Alien : Snap.Aliens)
	{
		const double Body = Alien.Radius * UnitsPerPx * 2.6 / 100.0;
		const double Rise = (Alien.Flags & ECVAlienFlag::Emerging) != 0 ? 0.4 : 1.0;
		Transforms.Add(FTransform(FRotator(0.0, FMath::RadiansToDegrees(Alien.Facing), 0.0),
			FVector(Alien.Pos.X * UnitsPerPx, Alien.Pos.Y * UnitsPerPx, Body * 35.0 * Rise), FVector(Body * 1.3, Body, Body * 0.7 * Rise)));
	}
	Show(KAlien, Transforms);

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
			const double Top = Tile == ECVTile::Crate ? 86.0 : Tile == ECVTile::Locker ? 190.0 : 26.0;
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

	// the power cell sits on its rack until you carry it off
	const bool bCellOnRack = !Snap.bPower && !Snap.Has(ECVFlag::HasCell);
	Transforms.Reset();
	for (const FCVThing& Thing : Things)
	{
		if (bCellOnRack && Thing.Kind == TEXT("cell"))
		{
			Transforms.Add(PieceAt(KCell, FVector((Thing.Tile.X + 0.5) * TileCm, (Thing.Tile.Y + 0.5) * TileCm, 0.0)));
		}
	}
	Show(KCell, Transforms);

	// lamps: the battery lamp always; the rest once the generator runs, each stuttering on in its own time
	if (Snap.bPower && PowerAt < 0.f)
	{
		PowerUp();
	}
	for (int32 Index = 0; Index < LampOnAt.Num() && Index < Lamps.Num(); ++Index)
	{
		float Level01 = LampAlways[Index] ? 1.f : 0.f;
		if (!LampAlways[Index] && Snap.bPower && Now >= LampOnAt[Index])
		{
			Level01 = Now - LampOnAt[Index] < 0.7f ? (FMath::FRand() < 0.5f ? 0.1f : 1.f) : 1.f;
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
	Wanted.Append(CreepGlows);
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
