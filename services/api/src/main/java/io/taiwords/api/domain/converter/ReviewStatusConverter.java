package io.taiwords.api.domain.converter;

import io.taiwords.api.domain.ReviewStatus;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class ReviewStatusConverter implements AttributeConverter<ReviewStatus, String> {
    @Override
    public String convertToDatabaseColumn(ReviewStatus attribute) {
        return attribute == null ? null : attribute.getDbValue();
    }

    @Override
    public ReviewStatus convertToEntityAttribute(String dbData) {
        return dbData == null ? null : ReviewStatus.fromDb(dbData);
    }
}
