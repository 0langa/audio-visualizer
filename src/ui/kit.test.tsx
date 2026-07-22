// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollapsibleSection, Segmented, SelectRow, SliderRow, ToggleRow } from "./kit";

afterEach(cleanup);

describe("Segmented", () => {
  const OPTS = [
    { value: "a", label: "Alpha", hint: "first" },
    { value: "b", label: "Beta", hint: "second", disabled: true },
    { value: "c", label: "Gamma" },
  ];

  it("marks the active segment and fires onChange with the value", async () => {
    const onChange = vi.fn();
    render(<Segmented options={OPTS} value="a" onChange={onChange} ariaLabel="pick" />);
    const group = screen.getByRole("group", { name: "pick" });
    const buttons = group.querySelectorAll("button");
    expect(buttons[0].className).toContain("active");
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(buttons[2].getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(buttons[2]);
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("per-option and whole-control disabled both block clicks", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Segmented options={OPTS} value="a" onChange={onChange} />);
    await userEvent.click(screen.getByText("Beta")); // option-disabled
    expect(onChange).not.toHaveBeenCalled();
    rerender(<Segmented options={OPTS} value="a" onChange={onChange} disabled />);
    await userEvent.click(screen.getByText("Gamma"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("routes option hints to onHint on hover and clears on leave", async () => {
    const onHint = vi.fn();
    render(<Segmented options={OPTS} value="a" onChange={() => undefined} onHint={onHint} />);
    await userEvent.hover(screen.getByText("Alpha"));
    expect(onHint).toHaveBeenLastCalledWith("first");
    await userEvent.unhover(screen.getByText("Alpha"));
    expect(onHint).toHaveBeenLastCalledWith(null);
  });
});

describe("ToggleRow", () => {
  it("renders a switch reflecting checked and toggles", async () => {
    const onChange = vi.fn();
    render(<ToggleRow label="Grid" checked={false} onChange={onChange} />);
    const sw = screen.getByRole("switch", { name: "Grid" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    await userEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("SliderRow", () => {
  it("formats the readout by step (2dp under 1, integers otherwise)", () => {
    render(<SliderRow label="Amt" min={0} max={1} step={0.01} value={0.5} onChange={() => 0} />);
    expect(screen.getByText("0.50")).toBeTruthy();
    render(<SliderRow label="N" min={0} max={10} step={1} value={7} onChange={() => 0} />);
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("honors a custom format", () => {
    render(
      <SliderRow
        label="Pct"
        min={0}
        max={2}
        step={0.05}
        value={1.5}
        onChange={() => 0}
        format={(v) => `${Math.round(v * 100)}%`}
      />,
    );
    expect(screen.getByText("150%")).toBeTruthy();
  });
});

describe("SelectRow", () => {
  it("renders options and parses the change value", async () => {
    const onChange = vi.fn();
    render(
      <SelectRow
        label="FPS"
        value={30}
        options={[
          { value: 30, label: "30 fps" },
          { value: 60, label: "60 fps" },
        ]}
        onChange={onChange}
        parse={Number}
      />,
    );
    await userEvent.selectOptions(screen.getByRole("combobox"), "60");
    expect(onChange).toHaveBeenCalledWith(60);
  });
});

describe("CollapsibleSection", () => {
  it("uncontrolled: toggles its body and aria-expanded", async () => {
    render(
      <CollapsibleSection title="Motion">
        <div>body-content</div>
      </CollapsibleSection>,
    );
    const btn = screen.getByRole("button", { name: /Motion/ });
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByText("body-content")).toBeTruthy();
    await userEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("body-content")).toBeNull();
  });

  it("controlled: renders from the open prop and reports the intended state", async () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <CollapsibleSection title="Sync" open={false} onToggle={onToggle}>
        <div>sync-body</div>
      </CollapsibleSection>,
    );
    expect(screen.queryByText("sync-body")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Sync/ }));
    expect(onToggle).toHaveBeenCalledWith(true);
    // Parent owns the state — body appears only when the prop changes.
    expect(screen.queryByText("sync-body")).toBeNull();
    rerender(
      <CollapsibleSection title="Sync" open onToggle={onToggle}>
        <div>sync-body</div>
      </CollapsibleSection>,
    );
    expect(screen.queryByText("sync-body")).toBeTruthy();
  });
});
