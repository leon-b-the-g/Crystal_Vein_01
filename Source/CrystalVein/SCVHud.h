#pragma once

#include "CoreMinimal.h"
#include "Widgets/DeclarativeSyntaxSupport.h"
#include "Widgets/SCompoundWidget.h"

/** What the HUD shows this frame. The controller fills it in; an empty string hides its line. */
struct FCVHudState
{
	FString Room;
	FString Objective;
	FString Prompt;
	FString Message;
	FString Whisper;
	FString Weapon;
	FString Quick;
	FString Status;
	FString Hint;
	float Health = 0.f;
	float MaxHealth = 100.f;
	float Stamina = 0.f;
	float MaxStamina = 100.f;
	/** a search or a pick-up under way, 0 to 1; below 0: none */
	float Channel = -1.f;
	bool bPlaying = false;
	/** the panel: a note, a view, the end of a run. It covers most of the screen on purpose. */
	bool bPanel = false;
	FString PanelTitle;
	FString PanelBody;
	FString PanelHint;
};

/**
 * The greybox HUD, in Slate so it needs no assets.
 * shortcut: text and bars only, no icons, no inventory screen; the real UI is a CommonUI/UMG pass once the editor can be driven from here.
 */
class SCVHud : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SCVHud) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

	FCVHudState State;

private:
	TSharedRef<SWidget> Line(TFunction<FString()> Text, const TCHAR* Face, float Size, const FLinearColor& Color, bool bCentre = false);
};
