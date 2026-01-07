import React, { useEffect, useRef, useState } from "react";
import { Dropdown, Tooltip } from "antd";
import { CheckOutlined } from "@ant-design/icons";

interface StepItem {
    title: string;
    description?: string;
}

interface ModernStepsProps {
    current: number;
    items: StepItem[];
    className?: string;
    onStepClick?: (stepIndex: number) => void;
    disabledSteps?: number[]; // Array of step indices that should be disabled
}

const ModernSteps: React.FC<ModernStepsProps> = ({
    current,
    items,
    className = "",
    onStepClick,
    disabledSteps = [],
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [hiddenSteps, setHiddenSteps] = useState<{
        left: number[];
        right: number[];
    }>({ left: [], right: [] });

    // Check scroll state and hidden steps
    const updateScrollState = () => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const { scrollLeft, scrollWidth, clientWidth } = container;
        setCanScrollLeft(scrollLeft > 10);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);

        // Calculate which steps are hidden
        const stepElements = Array.from(container.children) as HTMLElement[];
        const leftHidden: number[] = [];
        const rightHidden: number[] = [];

        stepElements.forEach((el, index) => {
            const elLeft = el.offsetLeft;
            const elRight = el.offsetLeft + el.offsetWidth;

            if (elRight < scrollLeft) {
                leftHidden.push(index);
            } else if (elLeft > scrollLeft + clientWidth) {
                rightHidden.push(index);
            }
        });

        setHiddenSteps({ left: leftHidden, right: rightHidden });
    };

    // Auto-scroll to active step
    useEffect(() => {
        if (scrollContainerRef.current) {
            const activeElement = scrollContainerRef.current.children[
                current
            ] as HTMLElement;
            if (activeElement) {
                const container = scrollContainerRef.current;
                const scrollLeft =
                    activeElement.offsetLeft -
                    container.offsetWidth / 2 +
                    activeElement.offsetWidth / 2;
                container.scrollTo({
                    left: Math.max(0, scrollLeft),
                    behavior: "smooth",
                });
            }
        }
        // Update scroll state after animation
        setTimeout(updateScrollState, 350);
    }, [current]);

    // Initialize and update scroll state
    useEffect(() => {
        updateScrollState();
        const container = scrollContainerRef.current;
        if (container) {
            container.addEventListener("scroll", updateScrollState);
            window.addEventListener("resize", updateScrollState);
        }
        return () => {
            if (container) {
                container.removeEventListener("scroll", updateScrollState);
                window.removeEventListener("resize", updateScrollState);
            }
        };
    }, [items]);

    const handleStepClick = (index: number) => {
        if (disabledSteps.includes(index)) return;
        if (onStepClick) {
            onStepClick(index);
        }
    };

    const scrollTo = (direction: "left" | "right") => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const scrollAmount = container.clientWidth * 0.6;
        container.scrollBy({
            left: direction === "left" ? -scrollAmount : scrollAmount,
            behavior: "smooth",
        });
    };

    const goToStep = (index: number) => {
        handleStepClick(index);
        // Also scroll to make the step visible
        const container = scrollContainerRef.current;
        if (container) {
            const stepElement = container.children[index] as HTMLElement;
            if (stepElement) {
                const scrollLeft =
                    stepElement.offsetLeft -
                    container.offsetWidth / 2 +
                    stepElement.offsetWidth / 2;
                container.scrollTo({
                    left: Math.max(0, scrollLeft),
                    behavior: "smooth",
                });
            }
        }
    };

    // Create dropdown menu items for hidden steps
    const createHiddenStepsMenu = (stepIndices: number[]) => ({
        items: stepIndices.map((index) => ({
            key: index,
            label: (
                <div
                    className={`flex items-center gap-2 ${
                        disabledSteps.includes(index) ? "opacity-50" : ""
                    }`}
                >
                    <span
                        className={`
                        w-5 h-5 rounded-full flex items-center justify-center text-xs
                        ${
                            index < current
                                ? "bg-blue-100 text-blue-600"
                                : index === current
                                ? "bg-blue-500 text-white"
                                : "bg-gray-100 text-gray-500"
                        }
                    `}
                    >
                        {index < current ? (
                            <CheckOutlined style={{ fontSize: 10 }} />
                        ) : (
                            index + 1
                        )}
                    </span>
                    <span>{items[index]?.title}</span>
                </div>
            ),
            disabled: disabledSteps.includes(index),
            onClick: () => goToStep(index),
        })),
    });

    return (
        <div className={`w-full ${className}`}>
            <div className="relative flex items-center">
                {/* Left scroll indicator */}
                {canScrollLeft && (
                    <div className="absolute left-0 z-10 flex items-center">
                        <Dropdown
                            menu={createHiddenStepsMenu(hiddenSteps.left)}
                            placement="bottomLeft"
                            trigger={["click"]}
                        >
                            <button
                                className="flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-all"
                                title={`${hiddenSteps.left.length} more step${
                                    hiddenSteps.left.length !== 1 ? "s" : ""
                                }`}
                            >
                                <span className="text-xs font-bold">
                                    +{hiddenSteps.left.length}
                                </span>
                            </button>
                        </Dropdown>
                        <div className="w-6 h-full bg-gradient-to-r from-white to-transparent pointer-events-none" />
                    </div>
                )}

                {/* Steps container */}
                <div
                    ref={scrollContainerRef}
                    className="flex items-center overflow-x-auto pb-2 scrollbar-hide no-scrollbar px-1"
                    style={{
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                        maskImage:
                            canScrollLeft || canScrollRight
                                ? `linear-gradient(to right, ${
                                      canScrollLeft
                                          ? "transparent 0px, black 40px"
                                          : "black 0px"
                                  }, ${
                                      canScrollRight
                                          ? "black calc(100% - 40px), transparent 100%"
                                          : "black 100%"
                                  })`
                                : undefined,
                        WebkitMaskImage:
                            canScrollLeft || canScrollRight
                                ? `linear-gradient(to right, ${
                                      canScrollLeft
                                          ? "transparent 0px, black 40px"
                                          : "black 0px"
                                  }, ${
                                      canScrollRight
                                          ? "black calc(100% - 40px), transparent 100%"
                                          : "black 100%"
                                  })`
                                : undefined,
                    }}
                >
                    {items.map((item, index) => {
                        const isCompleted = index < current;
                        const isActive = index === current;
                        const isDisabled = disabledSteps.includes(index);
                        const isClickable = onStepClick && !isDisabled;

                        return (
                            <div
                                key={index}
                                className="flex items-center shrink-0"
                            >
                                <Tooltip
                                    title={
                                        isDisabled
                                            ? "Complete previous steps first"
                                            : item.description || item.title
                                    }
                                    placement="bottom"
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleStepClick(index)}
                                        disabled={isDisabled}
                                        className={`
                                            flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 border select-none
                                            ${
                                                isActive
                                                    ? "bg-blue-50 text-blue-700 border-blue-500 shadow-sm scale-105 font-bold"
                                                    : isCompleted
                                                    ? "bg-blue-50/50 text-blue-600 border-transparent opacity-90"
                                                    : "bg-gray-50 text-gray-400 border-transparent"
                                            }
                                            ${
                                                isDisabled
                                                    ? "opacity-40 cursor-not-allowed"
                                                    : isClickable
                                                    ? "cursor-pointer hover:shadow-md hover:scale-102"
                                                    : ""
                                            }
                                        `}
                                    >
                                        <span
                                            className={`
                                            w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2
                                            ${
                                                isActive
                                                    ? "bg-blue-500 text-white"
                                                    : isCompleted
                                                    ? "bg-blue-400 text-white"
                                                    : "bg-gray-200 text-gray-500"
                                            }
                                        `}
                                        >
                                            {isCompleted ? (
                                                <CheckOutlined
                                                    style={{ fontSize: 10 }}
                                                />
                                            ) : (
                                                index + 1
                                            )}
                                        </span>
                                        <span className="whitespace-nowrap">
                                            {item.title}
                                        </span>
                                    </button>
                                </Tooltip>

                                {/* Connector Line */}
                                {index < items.length - 1 && (
                                    <div
                                        className={`
                                        w-4 h-0.5 mx-1.5 rounded-full shrink-0 transition-colors duration-300
                                        ${
                                            isCompleted
                                                ? "bg-blue-300"
                                                : "bg-gray-200"
                                        }
                                    `}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Right scroll indicator */}
                {canScrollRight && (
                    <div className="absolute right-0 z-10 flex items-center">
                        <div className="w-6 h-full bg-gradient-to-l from-white to-transparent pointer-events-none" />
                        <Dropdown
                            menu={createHiddenStepsMenu(hiddenSteps.right)}
                            placement="bottomRight"
                            trigger={["click"]}
                        >
                            <button
                                className="flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-all"
                                title={`${hiddenSteps.right.length} more step${
                                    hiddenSteps.right.length !== 1 ? "s" : ""
                                }`}
                            >
                                <span className="text-xs font-bold">
                                    +{hiddenSteps.right.length}
                                </span>
                            </button>
                        </Dropdown>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModernSteps;
