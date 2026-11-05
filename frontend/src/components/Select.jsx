import React, {
  Children,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

function readOptions(children, group = "") {
  return Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child)) return [];
    if (child.type === "optgroup")
      return readOptions(child.props.children, child.props.label);
    if (child.type !== "option") return [];
    return [
      {
        value: String(child.props.value ?? child.props.children),
        label: child.props.children,
        group,
      },
    ];
  });
}

export default function Select({
  children,
  value,
  onChange,
  disabled,
  required = false,
  validationMessage = "Please select an option.",
  ...props
}) {
  const options = readOptions(children);
  const selected = options.findIndex(
    (option) => option.value === String(value),
  );
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const search = useRef({ text: "", time: 0 });
  const id = useId();

  function show() {
    if (disabled) return;
    setActive(Math.max(0, selected));
    setOpen(true);
  }
  function choose(index) {
    if (!options[index]) return;
    onChange?.({ target: { value: options[index].value } });
    setInvalid(required && !options[index].value);
    setOpen(false);
    trigger.current?.focus();
  }

  useLayoutEffect(() => {
    if (!open) return;
    function place(event) {
      if (event && menu.current?.contains(event.target)) return;
      const rect = trigger.current.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const upwards = below < 180 && above > below;
      setPosition({
        left: Math.max(
          8,
          Math.min(rect.left, window.innerWidth - rect.width - 8),
        ),
        width: rect.width,
        maxHeight: Math.max(60, Math.min(280, upwards ? above : below)),
        ...(upwards
          ? { bottom: window.innerHeight - rect.top + 5 }
          : { top: rect.bottom + 5 }),
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function outside(event) {
      if (
        !trigger.current?.contains(event.target) &&
        !menu.current?.contains(event.target)
      )
        setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  useEffect(() => {
    const row = menu.current?.querySelector(`[data-index="${active}"]`);
    if (!row) return;
    if (row.offsetTop < menu.current.scrollTop)
      menu.current.scrollTop = row.offsetTop;
    if (
      row.offsetTop + row.offsetHeight >
      menu.current.scrollTop + menu.current.clientHeight
    ) {
      menu.current.scrollTop =
        row.offsetTop + row.offsetHeight - menu.current.clientHeight;
    }
  }, [active, open, position]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  function handleKey(event) {
    if (
      ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape"].includes(
        event.key,
      )
    )
      event.preventDefault();
    if (event.key === "Tab" || event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (open) choose(active);
      else show();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!open) show();
      else
        setActive((index) =>
          Math.max(
            0,
            Math.min(
              options.length - 1,
              index + (event.key === "ArrowDown" ? 1 : -1),
            ),
          ),
        );
    } else if (event.key === "Home" || event.key === "End") {
      if (!open) show();
      setActive(event.key === "Home" ? 0 : options.length - 1);
    } else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const now = Date.now();
      const text =
        (now - search.current.time < 700 ? search.current.text : "") +
        event.key.toLowerCase();
      search.current = { text, time: now };
      const index = options.findIndex((option) =>
        String(option.label).toLowerCase().startsWith(text),
      );
      if (index >= 0) {
        setOpen(true);
        setActive(index);
      }
    }
  }

  return (
    <>
      <button
        {...props}
        ref={trigger}
        type="button"
        role="combobox"
        className={`select-trigger${open ? " is-open" : ""}`}
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={handleKey}
        onBlur={(event) => {
          if (!menu.current?.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <span>{options[selected]?.label || "Select option"}</span>
        <ChevronDown size={15} />
      </button>
      {required && (
        <input
          className="select-validation-input"
          type="text"
          value={value ?? ""}
          onChange={() => {}}
          required
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          onInvalid={(event) => {
            event.preventDefault();
            setInvalid(true);
            trigger.current?.focus();
          }}
        />
      )}
      {invalid && !disabled && (
        <span id={`${id}-error`} className="select-error" role="alert">
          {validationMessage}
        </span>
      )}
      {open &&
        position &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="listbox"
            aria-label={props["aria-label"] || "Options"}
            className="select-menu"
            style={position}
            onMouseDown={(event) => event.preventDefault()}
          >
            {options.map((option, index) => (
              <React.Fragment key={`${option.value}-${index}`}>
                {option.group && option.group !== options[index - 1]?.group && (
                  <div className="select-group" role="presentation">
                    {option.group}
                  </div>
                )}
                <div
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={index === selected}
                  data-index={index}
                  className={`select-option${index === active ? " is-active" : ""}`}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(index)}
                >
                  {option.label}
                </div>
              </React.Fragment>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
