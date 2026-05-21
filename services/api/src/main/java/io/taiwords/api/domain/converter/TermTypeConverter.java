package io.taiwords.api.domain.converter;

import io.taiwords.api.domain.TermType;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Java enum (UPPER_CASE) ↔ DB string (snake_case) 轉換器。
 * DB 值固定，Java enum 名稱可重構而不影響資料。
 */
@Converter(autoApply = true)
public class TermTypeConverter implements AttributeConverter<TermType, String> {
    @Override
    public String convertToDatabaseColumn(TermType attribute) {
        return attribute == null ? null : attribute.getDbValue();
    }

    @Override
    public TermType convertToEntityAttribute(String dbData) {
        return dbData == null ? null : TermType.fromDb(dbData);
    }
}
