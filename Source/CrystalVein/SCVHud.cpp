#include "SCVHud.h"
#include "Styling/CoreStyle.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SConstraintCanvas.h"
#include "Widgets/Notifications/SProgressBar.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/SOverlay.h"
#include "Widgets/Text/STextBlock.h"

namespace
{
	// Nothing on screen is smaller than 20 pt, about 27 px at 1080p (players, 2026-11-10: the web HUD was too small to read).
	const float HudSmallPt = 20.f;
	const float HudBodyPt = 24.f;
	const float HudLargePt = 30.f;
	const float HudTitlePt = 40.f;

	// no red here: red is alien and nothing else
	const FLinearColor HudInk(0.92f, 0.94f, 0.97f);
	const FLinearColor HudDim(0.58f, 0.63f, 0.70f);
	const FLinearColor HudAmber(1.f, 0.66f, 0.2f);
	const FLinearColor HudCold(0.55f, 0.85f, 0.95f);
	const FLinearColor HudPanel(0.012f, 0.016f, 0.022f, 0.95f);
	const FLinearColor HudVeil(0.f, 0.f, 0.f, 0.6f);

	EVisibility ShownIf(bool bShown)
	{
		return bShown ? EVisibility::HitTestInvisible : EVisibility::Collapsed;
	}
}

TSharedRef<SWidget> SCVHud::Line(TFunction<FString()> Text, const TCHAR* Face, float Size, const FLinearColor& Color, bool bCentre)
{
	return SNew(STextBlock)
		.Text_Lambda([Text]() { return FText::FromString(Text()); })
		.Visibility_Lambda([Text]() { return ShownIf(!Text().IsEmpty()); })
		.Font(FCoreStyle::GetDefaultFontStyle(Face, Size))
		.ColorAndOpacity(Color)
		.ShadowOffset(FVector2D(1.5, 1.5))
		.ShadowColorAndOpacity(FLinearColor(0.f, 0.f, 0.f, 0.85f))
		.Justification(bCentre ? ETextJustify::Center : ETextJustify::Left)
		.AutoWrapText(true);
}

void SCVHud::Construct(const FArguments& InArgs)
{
	SetVisibility(EVisibility::HitTestInvisible); // the mouse belongs to the game: it aims
	const FSlateBrush* White = FCoreStyle::Get().GetBrush("WhiteBrush");

	ChildSlot
	[
		SNew(SOverlay)

		// top left: where you are and what the section wants
		+ SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Top).Padding(56.f, 44.f)
		[
			SNew(SBox).WidthOverride(860.f)
			[
				SNew(SVerticalBox)
				+ SVerticalBox::Slot().AutoHeight()
				[
					Line([this]() { return State.Room.ToUpper(); }, TEXT("Bold"), HudSmallPt, HudDim)
				]
				+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 6.f, 0.f, 0.f)
				[
					Line([this]() { return State.Objective; }, TEXT("Regular"), HudLargePt, HudInk)
				]
			]
		]

		// bottom left: you
		+ SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Bottom).Padding(56.f, 48.f)
		[
			SNew(SVerticalBox)
			.Visibility_Lambda([this]() { return ShownIf(State.bPlaying); })
			+ SVerticalBox::Slot().AutoHeight()
			[
				Line([this]() { return State.Quick; }, TEXT("Regular"), HudSmallPt, HudDim)
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 6.f, 0.f, 0.f)
			[
				Line([this]() { return State.Weapon; }, TEXT("Bold"), HudBodyPt, HudInk)
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 12.f, 0.f, 0.f).HAlign(HAlign_Left)
			[
				SNew(SBox).WidthOverride(460.f).HeightOverride(24.f)
				[
					SNew(SProgressBar)
					.Percent_Lambda([this]() -> TOptional<float> { return State.MaxHealth > 0.f ? State.Health / State.MaxHealth : 0.f; })
					.FillColorAndOpacity_Lambda([this]() -> FSlateColor { return State.Health < State.MaxHealth * 0.2f ? HudAmber : HudInk; })
				]
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 6.f, 0.f, 0.f).HAlign(HAlign_Left)
			[
				SNew(SBox).WidthOverride(460.f).HeightOverride(10.f)
				[
					SNew(SProgressBar)
					.Percent_Lambda([this]() -> TOptional<float> { return State.MaxStamina > 0.f ? State.Stamina / State.MaxStamina : 0.f; })
					.FillColorAndOpacity(HudCold)
				]
			]
		]

		// bottom right: the controls, for the first while
		+ SOverlay::Slot().HAlign(HAlign_Right).VAlign(VAlign_Bottom).Padding(56.f, 48.f)
		[
			SNew(SBox).WidthOverride(560.f)
			[
				Line([this]() { return State.Hint; }, TEXT("Regular"), HudSmallPt, HudDim)
			]
		]

		// bottom centre: what the ship says, what your head says, and what E would do
		+ SOverlay::Slot().HAlign(HAlign_Center).VAlign(VAlign_Bottom).Padding(0.f, 0.f, 0.f, 150.f)
		[
			SNew(SBox).WidthOverride(1000.f)
			[
				SNew(SVerticalBox)
				+ SVerticalBox::Slot().AutoHeight()
				[
					Line([this]() { return State.Whisper; }, TEXT("Italic"), HudBodyPt, HudCold, true)
				]
				+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 10.f, 0.f, 0.f)
				[
					Line([this]() { return State.Message; }, TEXT("Regular"), HudBodyPt, HudInk, true)
				]
				+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 16.f, 0.f, 0.f)
				[
					Line([this]() { return State.Prompt; }, TEXT("Bold"), HudLargePt, HudAmber, true)
				]
				+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 10.f, 0.f, 0.f).HAlign(HAlign_Center)
				[
					SNew(SBox).WidthOverride(360.f).HeightOverride(10.f)
					.Visibility_Lambda([this]() { return ShownIf(State.Channel >= 0.f); })
					[
						SNew(SProgressBar)
						.Percent_Lambda([this]() -> TOptional<float> { return FMath::Clamp(State.Channel, 0.f, 1.f); })
						.FillColorAndOpacity(HudAmber)
					]
				]
			]
		]

		// centre: the link to the sim, when there is none
		+ SOverlay::Slot().HAlign(HAlign_Center).VAlign(VAlign_Center)
		[
			SNew(SBox).WidthOverride(1100.f)
			[
				Line([this]() { return State.Status; }, TEXT("Regular"), HudLargePt, HudAmber, true)
			]
		]

		// the panel: 64 % of the width, 68 % of the height (players, 2026-11-10: pop-ups were too small to read)
		+ SOverlay::Slot()
		[
			SNew(SBorder)
			.BorderImage(White)
			.BorderBackgroundColor(HudVeil)
			.Padding(0.f)
			.Visibility_Lambda([this]() { return ShownIf(State.bPanel); })
			[
				SNew(SConstraintCanvas)
				+ SConstraintCanvas::Slot().Anchors(FAnchors(0.18f, 0.16f, 0.82f, 0.84f)).Offset(FMargin(0.f))
				[
					SNew(SBorder)
					.BorderImage(White)
					.BorderBackgroundColor(HudPanel)
					.Padding(FMargin(60.f, 48.f))
					[
						SNew(SVerticalBox)
						+ SVerticalBox::Slot().AutoHeight()
						[
							Line([this]() { return State.PanelTitle; }, TEXT("Bold"), HudTitlePt, HudInk)
						]
						+ SVerticalBox::Slot().FillHeight(1.f).Padding(0.f, 30.f, 0.f, 0.f)
						[
							Line([this]() { return State.PanelBody; }, TEXT("Regular"), HudLargePt, HudInk)
						]
						+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 24.f, 0.f, 0.f)
						[
							Line([this]() { return State.PanelHint; }, TEXT("Bold"), HudBodyPt, HudAmber)
						]
					]
				]
			]
		]
	];
}
