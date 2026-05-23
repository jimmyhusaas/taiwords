package io.taiwords.api.api;

import io.taiwords.api.domain.Category;
import io.taiwords.api.repository.CategoryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CategoryController.class)
class CategoryControllerTest {

    @Autowired MockMvc mvc;
    @MockBean CategoryRepository categoryRepository;

    @Test
    void list_returns_all_categories() throws Exception {
        when(categoryRepository.findAll()).thenReturn(List.of(
                new Category("it", "資訊／軟體", "電腦相關"),
                new Category("food", "飲食", "食物")
        ));

        mvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].slug").value("it"))
                .andExpect(jsonPath("$[0].nameZhTw").value("資訊／軟體"))
                .andExpect(jsonPath("$[1].slug").value("food"));
    }

    @Test
    void list_returns_empty_array_when_no_categories() throws Exception {
        when(categoryRepository.findAll()).thenReturn(List.of());

        mvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
