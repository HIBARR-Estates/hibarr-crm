import { Input, Select, Form } from "antd";
import { useFetchCountries } from "hooks/useFetchCountries";
import { useState } from "react";
import { TCountry } from "types/country";
import { removeDuplicateAttributeEntriesFromArray } from "utils/dataHelpers/removeDuplicateAttributeEntriesFromArray";
import {
    generalValidationRules,
    phoneNumberValidationRule,
    generalValidationRulesOp,
    phoneNumberValidationRuleOp,
} from "utils/formHelpers/validation";

export const FormPhoneInput: React.FC<{
    Form: typeof Form;
    showLabel?: boolean;
    control?: { label: string; name: string };
    optional?: boolean;
}> = ({
    Form,
    showLabel = true,
    control = { label: "Phone Number", name: "phone" },
    optional = false,
}) => {
    const { data: countries, isSuccess } = useFetchCountries();
    const [searchedCountries, setSearchedCountries] = useState<TCountry[]>([]);

    const handleCountrySearch = (val: string) => {
        if (isSuccess) {
            if (val.length > 0) {
                const sCountries = countries.filter(
                    (item) =>
                        item.name.toLowerCase().indexOf(val.toLowerCase()) !==
                            -1 ||
                        `+${item?.code}`
                            .toLowerCase()
                            .indexOf(`${val.toLowerCase()}`) !== -1
                );
                setSearchedCountries(sCountries);
            } else {
                setSearchedCountries([]);
            }
        }
    };

    const mainCountries =
        searchedCountries.length > 0 ? searchedCountries : countries;
    if (isSuccess) {
        return (
            <Form.Item
                name={control.name}
                label={showLabel ? control?.label : null}
            >
                <Input.Group
                    compact={true}
                    style={{
                        width: "100%",
                        minWidth: "100%",
                        maxWidth: "100%",
                        flexWrap: "nowrap",
                        flexDirection: "row",
                        display: "flex",
                    }}
                >
                    <Form.Item
                        noStyle
                        rules={
                            optional
                                ? generalValidationRulesOp
                                : generalValidationRules
                        }
                        name={[control.name, "code"]}
                    >
                        <Select
                            showSearch
                            placeholder="Code"
                            allowClear
                            onClear={() => setSearchedCountries([])}
                            onSearch={handleCountrySearch}
                            className="rounded border-slate-400 "
                            defaultActiveFirstOption={false}
                            showArrow={false}
                            filterOption={false}
                            options={removeDuplicateAttributeEntriesFromArray(
                                mainCountries ?? [],
                                "code"
                            )
                                ?.sort(
                                    (a, b) => Number(a.code) - Number(b.code)
                                ) //Sort by country code
                                ?.map((item) => ({
                                    label: (
                                        <span className="flex gap-x-2">
                                            <span
                                                className={`flag-icon flag-icon-${item.sortName.toLowerCase()}`}
                                            />
                                            <span>{item?.code}</span>
                                        </span>
                                    ),
                                    value: item?.code,
                                }))}
                        />
                    </Form.Item>
                    <Form.Item
                        noStyle
                        rules={
                            optional
                                ? [phoneNumberValidationRuleOp]
                                : [phoneNumberValidationRule]
                        }
                        name={[control.name, "number"]}
                    >
                        <Input
                            placeholder="Phone"
                            className="rounded border-slate-400 text-left "
                        />
                    </Form.Item>
                </Input.Group>
            </Form.Item>
        );
    }
    return null;
};
